import { eq } from "drizzle-orm"
import { z } from "zod"
import { withAudit } from "@eleva/audit"
import {
  CLOSED_GATE_INVOICE_EVENT_TYPES,
  type ClosedGateInvoiceEventType,
} from "@eleva/accounting/platform-fee-events"
import {
  auth,
  listMemberNotificationPreferences,
  withPlatformAdminContext,
  type MemberNotificationPreference,
} from "@eleva/db"
import {
  getEmailTranslations,
  renderInvoiceClosedGate,
  type EmailLocale,
} from "@eleva/email"
import { Resend } from "resend"
import {
  CLOSED_GATE_INVOICE_NOTIFICATION_KINDS,
  type ClosedGateInvoiceNotificationKind,
} from "./kinds"

const CLOSED_GATE_TYPES = new Set<string>(CLOSED_GATE_INVOICE_EVENT_TYPES)

const ClosedGatePayloadSchema = z.object({
  invoiceKind: z.literal("platform_fee"),
  invoiceId: z.string().min(1),
  bookingPaymentId: z.string().min(1),
  expertOrgId: z.string().min(1),
  status: z.enum(["blocked", "skipped", "pending"]),
  number: z.null(),
  pdfUrl: z.null(),
  error: z.string().nullable(),
})

export type ClosedGateInvoiceSendEvent = {
  id: string
  type: string
  orgId: string
  payload: Record<string, unknown>
}

export type ClosedGateInvoiceRecipient = {
  userId: string
  email: string
  name: string
  locale: string | null
  role: string
}

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  idempotencyKey: string
}

export type SendClosedGateInvoiceDeps = {
  listRecipients?: (
    expertOrgId: string
  ) => Promise<ClosedGateInvoiceRecipient[]>
  listPreferences?: (userId: string) => Promise<MemberNotificationPreference[]>
  sendEmail?: (input: SendEmailInput) => Promise<void>
}

export async function sendClosedGateInvoiceNotification(
  event: ClosedGateInvoiceSendEvent,
  deps: SendClosedGateInvoiceDeps = {}
): Promise<void> {
  if (!isClosedGateKind(event.type)) {
    throw new Error(`send-notification: unsupported event type ${event.type}`)
  }

  const parsed = ClosedGatePayloadSchema.safeParse(event.payload)
  if (!parsed.success) {
    throw new Error(
      "send-notification: closed-gate payload is invalid or includes a document"
    )
  }
  const payload = parsed.data
  if (event.orgId !== payload.expertOrgId) {
    throw new Error("send-notification: event org does not match expert org")
  }
  const expectedType =
    `invoice.${payload.status}` satisfies ClosedGateInvoiceEventType
  if (event.type !== expectedType) {
    throw new Error(
      "send-notification: event type does not match payload status"
    )
  }

  const listRecipients = deps.listRecipients ?? listExpertOrgOperators
  const listPreferences =
    deps.listPreferences ?? listMemberNotificationPreferences
  const sendEmail = deps.sendEmail ?? sendViaResend

  const recipients = (await listRecipients(payload.expertOrgId)).filter(
    (row) => isOrgOperator(row.role) && row.email.includes("@")
  )
  if (recipients.length === 0) {
    throw new Error("send-notification: no operator recipients for expert org")
  }

  const kind = event.type
  for (const recipient of recipients) {
    // Consult Phase 5 prefs. `payment` is required, so a disabled
    // email×payment row does not suppress this send.
    await listPreferences(recipient.userId)
    const locale = toEmailLocale(recipient.locale)
    const html = await renderInvoiceClosedGate({
      status: payload.status,
      invoiceId: payload.invoiceId,
      name: recipient.name,
      error: payload.error,
      locale,
    })
    const t = getEmailTranslations(locale)
    await sendEmail({
      to: recipient.email,
      subject: subjectForStatus(t.subject, payload.status),
      html,
      idempotencyKey: `${event.id}:${recipient.userId}:email`,
    })
  }

  await withAudit(
    { orgId: event.orgId, actorUserId: null },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "notification",
        action: "sent",
        entityId: payload.invoiceId,
        payload: {
          kind,
          channel: "email",
          category: CLOSED_GATE_INVOICE_NOTIFICATION_KINDS[kind].category,
          recipientCount: recipients.length,
        },
      })
    }
  )
}

export function isClosedGateKind(
  type: string
): type is ClosedGateInvoiceNotificationKind {
  return CLOSED_GATE_TYPES.has(type)
}

export function isOrgOperator(role: string): boolean {
  const slugs = new Set(
    role.split(",").map((part) => part.trim().toLowerCase())
  )
  return slugs.has("owner") || slugs.has("admin")
}

export function toEmailLocale(value: string | null | undefined): EmailLocale {
  if (!value) return "en"
  const lower = value.toLowerCase()
  if (lower === "pt" || lower.startsWith("pt-")) return "pt"
  if (lower === "es" || lower.startsWith("es-")) return "es"
  return "en"
}

async function listExpertOrgOperators(
  expertOrgId: string
): Promise<ClosedGateInvoiceRecipient[]> {
  return withPlatformAdminContext(async (tx) =>
    tx
      .select({
        userId: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        locale: auth.user.locale,
        role: auth.member.role,
      })
      .from(auth.member)
      .innerJoin(auth.user, eq(auth.user.id, auth.member.userId))
      .where(eq(auth.member.organizationId, expertOrgId))
  )
}

function subjectForStatus(
  subject: {
    invoiceBlocked: string
    invoiceSkipped: string
    invoicePending: string
  },
  status: "blocked" | "skipped" | "pending"
): string {
  switch (status) {
    case "blocked":
      return subject.invoiceBlocked
    case "skipped":
      return subject.invoiceSkipped
    case "pending":
      return subject.invoicePending
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function fromAddress(): string {
  const candidates = [
    process.env.RESEND_FROM_EMAIL,
    process.env.RESEND_EMAIL_BOOKINGS_FROM,
  ]
  return (
    candidates.map((value) => value?.trim()).find((value) => value) ??
    "Eleva.care <noreply@eleva.care>"
  )
}

async function sendViaResend(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("[email] RESEND_API_KEY is not configured")
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send(
    {
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
    },
    { idempotencyKey: input.idempotencyKey }
  )
  if (error) {
    throw new Error(error.message)
  }
}
