import { eq, or, sql } from "drizzle-orm"
import { z } from "zod"
import { auth, main, withPlatformAdminContext } from "@eleva/db"
import {
  getEmailTranslations,
  renderPaymentPayoutNotice,
  type EmailLocale,
} from "@eleva/email"
import { sendNotification } from "./send-notification"
import { isOrgOperator, toEmailLocale } from "./send-closed-gate-invoice"

export const PAYMENT_PAYOUT_NOTIFICATION_KINDS = [
  "payment.failed",
  "payment.receipt",
  "payout.paid",
  "payout.approval_required",
] as const

export type PaymentPayoutNotificationKind =
  (typeof PAYMENT_PAYOUT_NOTIFICATION_KINDS)[number]

const PaymentPayloadSchema = z.object({
  paymentId: z.string().uuid(),
  bookingId: z.string().uuid(),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().min(1),
})

const PayoutPayloadSchema = z.object({
  payoutStateId: z.string().uuid(),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().min(1),
})

export type PaymentPayoutNotificationEvent = {
  id: string
  type: string
  orgId: string
  payload: Record<string, unknown>
}

const KIND_SET = new Set<string>(PAYMENT_PAYOUT_NOTIFICATION_KINDS)

export function isPaymentPayoutNotificationKind(
  type: string
): type is PaymentPayoutNotificationKind {
  return KIND_SET.has(type)
}

type SendDeps = {
  loadPaymentBooking?: typeof loadPaymentBooking
  loadPayoutOrg?: typeof loadPayoutOrg
  listStaff?: typeof listStaffRecipients
  listOperators?: typeof listExpertOrgOperators
  send?: typeof sendNotification
}

export async function sendPaymentPayoutNotification(
  event: PaymentPayoutNotificationEvent,
  deps: SendDeps = {}
): Promise<void> {
  if (!isPaymentPayoutNotificationKind(event.type)) {
    throw new Error(
      `send-notification: unsupported payment event ${event.type}`
    )
  }
  const send = deps.send ?? sendNotification
  switch (event.type) {
    case "payment.failed":
    case "payment.receipt":
      await sendPaymentKind(event, event.type, deps, send)
      return
    case "payout.paid":
    case "payout.approval_required":
      await sendPayoutKind(event, event.type, deps, send)
      return
    default: {
      const _exhaustive: never = event.type
      return _exhaustive
    }
  }
}

async function sendPaymentKind(
  event: PaymentPayoutNotificationEvent,
  kind: "payment.failed" | "payment.receipt",
  deps: SendDeps,
  send: typeof sendNotification
): Promise<void> {
  const parsed = PaymentPayloadSchema.safeParse(event.payload)
  if (!parsed.success) {
    throw new Error("send-notification: payment payload is invalid")
  }
  const load = deps.loadPaymentBooking ?? loadPaymentBooking
  const booking = await load(parsed.data.bookingId)
  if (!booking || booking.orgId !== event.orgId) {
    throw new Error("send-notification: booking not found for event org")
  }
  const locale = toEmailLocale(booking.bookedLocale)
  const amountFormatted = formatAmount(
    parsed.data.amountCents,
    parsed.data.currency,
    locale
  )
  const html = await renderPaymentPayoutNotice({
    kind,
    amountFormatted,
    reference: parsed.data.paymentId,
    name: displayFirstName(booking.memberName ?? booking.guestName),
    locale,
  })
  const t = getEmailTranslations(locale)
  const title =
    kind === "payment.failed" ? t.payment.failedTitle : t.payment.receiptTitle
  const body =
    kind === "payment.failed"
      ? t.payment.failedSubtitle
      : t.payment.receiptSubtitle
  const subject =
    kind === "payment.failed"
      ? t.subject.paymentFailed
      : t.subject.paymentReceipt
  const recipient = booking.memberUserId
    ? { userId: booking.memberUserId }
    : booking.guestEmail
      ? { email: booking.guestEmail, locale }
      : null
  if (!recipient) {
    throw new Error("send-notification: payment has no member recipient")
  }
  await send({
    kind,
    orgId: event.orgId,
    recipient,
    ctx: { title, body, subject, html },
    idempotencyKey: `payment:${parsed.data.paymentId}:${kind.slice("payment.".length)}`,
  })
}

async function sendPayoutKind(
  event: PaymentPayoutNotificationEvent,
  kind: "payout.paid" | "payout.approval_required",
  deps: SendDeps,
  send: typeof sendNotification
): Promise<void> {
  const parsed = PayoutPayloadSchema.safeParse(event.payload)
  if (!parsed.success) {
    throw new Error("send-notification: payout payload is invalid")
  }
  const loadPayout = deps.loadPayoutOrg ?? loadPayoutOrg
  const payout = await loadPayout(parsed.data.payoutStateId)
  if (!payout || payout.orgId !== event.orgId) {
    throw new Error("send-notification: payout not found for event org")
  }
  const recipients =
    kind === "payout.approval_required"
      ? await (deps.listStaff ?? listStaffRecipients)()
      : (
          await (deps.listOperators ?? listExpertOrgOperators)(payout.orgId)
        ).filter((row) => isOrgOperator(row.role) && row.email.includes("@"))
  if (recipients.length === 0) {
    throw new Error(`send-notification: no recipients for ${kind}`)
  }
  const results = await Promise.allSettled(
    recipients.map(async (row) => {
      const locale = toEmailLocale(row.locale)
      const amountFormatted = formatAmount(
        parsed.data.amountCents,
        parsed.data.currency,
        locale
      )
      const html = await renderPaymentPayoutNotice({
        kind,
        amountFormatted,
        reference: parsed.data.payoutStateId,
        name: displayFirstName(row.name),
        locale,
      })
      const t = getEmailTranslations(locale)
      const title =
        kind === "payout.paid" ? t.payout.paidTitle : t.payout.approvalTitle
      const body =
        kind === "payout.paid"
          ? t.payout.paidSubtitle
          : t.payout.approvalSubtitle
      const subject =
        kind === "payout.paid"
          ? t.subject.payoutPaid
          : t.subject.payoutApprovalRequired
      await send({
        kind,
        orgId: event.orgId,
        recipient: { userId: row.userId },
        ctx: { title, body, subject, html },
        idempotencyKey: `payout:${parsed.data.payoutStateId}:${kind.slice("payout.".length)}`,
      })
    })
  )
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  )
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      "payout notification delivery failed"
    )
  }
}

type PaymentBooking = {
  orgId: string
  bookedLocale: string | null
  memberUserId: string | null
  memberName: string | null
  guestEmail: string | null
  guestName: string | null
}

type NamedRecipient = {
  userId: string
  email: string
  name: string
  locale: string | null
  role: string
}

async function loadPaymentBooking(
  bookingId: string
): Promise<PaymentBooking | null> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        orgId: main.bookings.orgId,
        bookedLocale: main.bookings.bookedLocale,
        memberUserId: main.bookings.memberUserId,
        guestEmail: main.bookings.guestEmail,
        guestName: main.bookings.guestName,
      })
      .from(main.bookings)
      .where(eq(main.bookings.id, bookingId))
      .limit(1)
    if (!row) return null
    let memberName: string | null = null
    if (row.memberUserId) {
      const [member] = await tx
        .select({ name: auth.user.name })
        .from(auth.user)
        .where(eq(auth.user.id, row.memberUserId))
        .limit(1)
      memberName = member?.name ?? null
    }
    return { ...row, memberName }
  })
}

async function loadPayoutOrg(
  payoutStateId: string
): Promise<{ orgId: string } | null> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({ orgId: main.payoutStates.orgId })
      .from(main.payoutStates)
      .where(eq(main.payoutStates.id, payoutStateId))
      .limit(1)
    return row ?? null
  })
}

async function listExpertOrgOperators(
  expertOrgId: string
): Promise<NamedRecipient[]> {
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

function isStaffRole(role: string | null): boolean {
  if (!role) return false
  const slugs = new Set(
    role.split(",").map((part) => part.trim().toLowerCase())
  )
  return slugs.has("platform_admin") || slugs.has("staff_finance")
}

async function listStaffRecipients(): Promise<NamedRecipient[]> {
  const rows = await withPlatformAdminContext(async (tx) =>
    tx
      .select({
        userId: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        locale: auth.user.locale,
        role: auth.user.role,
      })
      .from(auth.user)
      .where(
        or(
          eq(auth.user.role, "platform_admin"),
          eq(auth.user.role, "staff_finance"),
          sql`${auth.user.role} like '%platform_admin%'`,
          sql`${auth.user.role} like '%staff_finance%'`
        )
      )
  )
  return rows.filter((row) => isStaffRole(row.role) && row.email.includes("@"))
}

function formatAmount(
  amountCents: number,
  currency: string,
  locale: EmailLocale
): string {
  const map: Record<EmailLocale, string> = {
    en: "en-GB",
    pt: "pt-PT",
    es: "es-ES",
  }
  try {
    return new Intl.NumberFormat(map[locale], {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountCents / 100)
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

function displayFirstName(
  value: string | null | undefined
): string | undefined {
  if (!value) return undefined
  const token = value.trim().split(/\s+/)[0]
  return token || undefined
}
