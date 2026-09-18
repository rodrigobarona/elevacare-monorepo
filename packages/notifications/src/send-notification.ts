import { z } from "zod"
import { withAudit } from "@eleva/audit"
import { listMemberNotificationPreferences } from "@eleva/db"
import {
  channelEnabled,
  supportedSendChannels,
  type NotificationChannel,
  type PreferenceRow,
} from "./channels"
import {
  claimDelivery,
  completeDelivery,
  insertInboxRow,
  isEmailSuppressed,
  loadUserRecipient,
  markFirstAttempt,
  recordProviderId,
  type ClaimInput,
  type ClaimOutcome,
  type DeliveryRow,
} from "./claim-delivery"
import { SendNotificationError } from "./errors"
import {
  NOTIFICATION_KINDS,
  type ScopedKind,
  type NotificationKind,
} from "./kinds"
import {
  adoptResendDelivery,
  sendViaResend,
  type ListedEmail,
  type RetrievedEmail,
  type SendEmailInput,
  type SendEmailResult,
} from "./send-email"

export type { NotificationChannel } from "./channels"

export type UserRecipient = { userId: string }
export type EmailRecipient = { email: string; locale?: "en" | "pt" | "es" }
export type NotificationRecipient = UserRecipient | EmailRecipient

export type NotificationContent = {
  title: string
  body: string
  subject: string
  html: string
  href?: string | null
  data?: Record<string, unknown>
}

export type OrgScopedKind = ScopedKind<"org">
export type UserScopedKind = ScopedKind<"user">

type SendBase = {
  recipient: NotificationRecipient
  ctx: NotificationContent
  idempotencyKey: string
  channelsOverride?: NotificationChannel[]
}

export type SendNotificationInput =
  | (SendBase & { kind: OrgScopedKind; orgId: string })
  | (SendBase & { kind: UserScopedKind; orgId?: undefined })

export type ChannelDeliveryResult = {
  channel: Exclude<NotificationChannel, "sms">
  deliveryId: string
  status:
    | "sent"
    | "failed"
    | "suppressed"
    | "held"
    | "queued"
    | "delivered"
    | "bounced"
    | "complained"
  providerId?: string | null
}

export type SendNotificationResult = {
  kind: NotificationKind
  deliveries: ChannelDeliveryResult[]
}

export type SendNotificationDeps = {
  now?: () => Date
  runId?: string
  claimDelivery?: (input: ClaimInput) => Promise<ClaimOutcome>
  markFirstAttempt?: (input: {
    id: string
    runId: string
    now: Date
  }) => Promise<Date>
  completeDelivery?: (input: {
    id: string
    runId: string
    claimedAt: Date
    status: "sent" | "failed" | "suppressed"
    providerId?: string | null
    error?: string | null
    now: Date
  }) => Promise<boolean>
  recordProviderId?: (input: {
    id: string
    providerId: string
    now: Date
  }) => Promise<void>
  insertInbox?: typeof insertInboxRow
  isEmailSuppressed?: (email: string) => Promise<boolean>
  loadUser?: typeof loadUserRecipient
  listPreferences?: (userId: string) => Promise<PreferenceRow[]>
  sendEmail?: (input: SendEmailInput) => Promise<SendEmailResult>
  listEmails?: (input: { to: string; since: Date }) => Promise<ListedEmail[]>
  getEmail?: (id: string) => Promise<RetrievedEmail | null>
  recordAudit?: (input: {
    orgId: string
    deliveryId: string
    kind: NotificationKind
    channel: Exclude<NotificationChannel, "sms">
    action: "sent" | "failed" | "suppressed"
  }) => Promise<void>
}

const RecipientSchema = z.union([
  z.object({ userId: z.string().uuid() }),
  z.object({
    email: z.string().email(),
    locale: z.enum(["en", "pt", "es"]).optional(),
  }),
])

const ContentSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  subject: z.string().min(1),
  html: z.string().min(1),
  href: z.string().nullable().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

type ParsedSend = {
  kind: NotificationKind
  orgId: string | undefined
  recipient: NotificationRecipient
  ctx: NotificationContent
  idempotencyKey: string
  channelsOverride: NotificationChannel[] | undefined
}

function isNotificationKind(value: string): value is NotificationKind {
  return Object.hasOwn(NOTIFICATION_KINDS, value)
}

function parseInput(input: SendNotificationInput): ParsedSend {
  const kindValue = z.string().safeParse(input.kind)
  if (!kindValue.success || !isNotificationKind(kindValue.data)) {
    throw new SendNotificationError(
      "VALIDATION",
      "kind is not a registered Lane 1 notification"
    )
  }
  const kind = kindValue.data
  const recipient = RecipientSchema.safeParse(input.recipient)
  if (!recipient.success) {
    throw new SendNotificationError("VALIDATION", "recipient is invalid")
  }
  const ctx = ContentSchema.safeParse(input.ctx)
  if (!ctx.success) {
    throw new SendNotificationError("VALIDATION", "ctx is invalid")
  }
  const idempotencyKey = z
    .string()
    .min(1)
    .max(256)
    .safeParse(input.idempotencyKey)
  if (!idempotencyKey.success) {
    throw new SendNotificationError("VALIDATION", "idempotencyKey is invalid")
  }

  const config = NOTIFICATION_KINDS[kind]
  let orgId: string | undefined
  if (config.scope === "org") {
    const parsedOrgId = z.string().uuid().safeParse(input.orgId)
    if (!parsedOrgId.success) {
      throw new SendNotificationError(
        input.orgId ? "VALIDATION" : "ORG_CONTEXT_REQUIRED",
        input.orgId ? "orgId must be a UUID" : "ORG_CONTEXT_REQUIRED"
      )
    }
    orgId = parsedOrgId.data
  } else if (input.orgId) {
    throw new SendNotificationError(
      "USER_KIND_HAS_NO_ORG",
      "user-scoped kinds must not include orgId"
    )
  }
  if (input.channelsOverride) {
    supportedSendChannels(kind, input.channelsOverride)
  }

  return {
    kind,
    orgId,
    recipient: recipient.data,
    ctx: ctx.data,
    idempotencyKey: idempotencyKey.data,
    channelsOverride: input.channelsOverride,
  }
}

async function defaultAudit(input: {
  orgId: string
  deliveryId: string
  kind: NotificationKind
  channel: Exclude<NotificationChannel, "sms">
  action: "sent" | "failed" | "suppressed"
}): Promise<void> {
  await withAudit(
    { orgId: input.orgId, actorUserId: null },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "notification",
        action: input.action,
        entityId: input.deliveryId,
        payload: {
          kind: input.kind,
          channel: input.channel,
          category: NOTIFICATION_KINDS[input.kind].category,
        },
      })
    }
  )
}

function isUserRecipient(
  recipient: NotificationRecipient
): recipient is UserRecipient {
  return "userId" in recipient
}

export async function sendNotification(
  input: SendNotificationInput,
  deps: SendNotificationDeps = {}
): Promise<SendNotificationResult> {
  const parsed = parseInput(input)
  const now = () => deps.now?.() ?? new Date()
  const runId = deps.runId ?? crypto.randomUUID()
  const claim = deps.claimDelivery ?? claimDelivery
  const markAttempt = deps.markFirstAttempt ?? markFirstAttempt
  const complete = deps.completeDelivery ?? completeDelivery
  const persistProviderId = deps.recordProviderId ?? recordProviderId
  const inbox = deps.insertInbox ?? insertInboxRow
  const suppressed = deps.isEmailSuppressed ?? isEmailSuppressed
  const loadUser = deps.loadUser ?? loadUserRecipient
  const listPreferences =
    deps.listPreferences ?? listMemberNotificationPreferences
  const sendEmail = deps.sendEmail ?? sendViaResend
  const recordAudit = deps.recordAudit ?? defaultAudit

  let userId: string | null = null
  let email: string
  let preferences: PreferenceRow[] = []

  if (isUserRecipient(parsed.recipient)) {
    const user = await loadUser(parsed.recipient.userId)
    if (!user?.email) {
      throw new SendNotificationError(
        "USER_NOT_FOUND",
        "recipient user not found"
      )
    }
    userId = user.userId
    email = user.email
    preferences = await listPreferences(user.userId)
  } else {
    email = parsed.recipient.email
  }

  const selected = isUserRecipient(parsed.recipient)
    ? supportedSendChannels(parsed.kind, parsed.channelsOverride).filter(
        (channel) =>
          channelEnabled({
            kind: parsed.kind,
            channel,
            preferences,
          })
      )
    : supportedSendChannels(parsed.kind, parsed.channelsOverride).filter(
        (channel) => channel === "email"
      )

  const deliveries: ChannelDeliveryResult[] = []
  let failure: unknown
  for (const channel of selected) {
    try {
      deliveries.push(
        await deliverChannel({
          parsed,
          channel,
          userId,
          email,
          runId,
          now: now(),
          claim,
          markAttempt,
          complete,
          persistProviderId,
          inbox,
          suppressed,
          sendEmail,
          listEmails: deps.listEmails,
          getEmail: deps.getEmail,
          recordAudit,
        })
      )
    } catch (error) {
      failure ??= error
    }
  }
  if (failure) throw failure

  return { kind: parsed.kind, deliveries }
}

async function deliverChannel(input: {
  parsed: ParsedSend
  channel: Exclude<NotificationChannel, "sms">
  userId: string | null
  email: string
  runId: string
  now: Date
  claim: NonNullable<SendNotificationDeps["claimDelivery"]>
  markAttempt: NonNullable<SendNotificationDeps["markFirstAttempt"]>
  complete: NonNullable<SendNotificationDeps["completeDelivery"]>
  persistProviderId: NonNullable<SendNotificationDeps["recordProviderId"]>
  inbox: NonNullable<SendNotificationDeps["insertInbox"]>
  suppressed: NonNullable<SendNotificationDeps["isEmailSuppressed"]>
  sendEmail: NonNullable<SendNotificationDeps["sendEmail"]>
  listEmails: SendNotificationDeps["listEmails"]
  getEmail: SendNotificationDeps["getEmail"]
  recordAudit: NonNullable<SendNotificationDeps["recordAudit"]>
}): Promise<ChannelDeliveryResult> {
  const claimed = await input.claim({
    runId: input.runId,
    now: input.now,
    orgId: input.parsed.orgId ?? null,
    idempotencyKey: input.parsed.idempotencyKey,
    kind: input.parsed.kind,
    userId: input.userId,
    recipientEmail: input.userId ? null : input.email,
    channel: input.channel,
  })

  if (claimed.outcome === "held") {
    return {
      channel: input.channel,
      deliveryId: claimed.row.id,
      status: "held",
      providerId: claimed.row.providerId,
    }
  }
  if (claimed.outcome === "already_complete") {
    return {
      channel: input.channel,
      deliveryId: claimed.row.id,
      status: claimed.row.status === "queued" ? "held" : claimed.row.status,
      providerId: claimed.row.providerId,
    }
  }

  const row = claimed.row
  switch (input.channel) {
    case "email":
      return deliverEmail({
        parsed: input.parsed,
        channel: "email",
        email: input.email,
        row,
        runId: input.runId,
        now: input.now,
        markAttempt: input.markAttempt,
        complete: input.complete,
        persistProviderId: input.persistProviderId,
        suppressed: input.suppressed,
        sendEmail: input.sendEmail,
        listEmails: input.listEmails,
        getEmail: input.getEmail,
        recordAudit: input.recordAudit,
      })
    case "in_app":
      return deliverInApp({
        parsed: input.parsed,
        channel: "in_app",
        userId: input.userId,
        row,
        runId: input.runId,
        now: input.now,
        markAttempt: input.markAttempt,
        complete: input.complete,
        inbox: input.inbox,
        recordAudit: input.recordAudit,
      })
    default: {
      const _exhaustive: never = input.channel
      return _exhaustive
    }
  }
}

async function finish(input: {
  parsed: ParsedSend
  channel: Exclude<NotificationChannel, "sms">
  row: DeliveryRow
  runId: string
  now: Date
  status: "sent" | "failed" | "suppressed"
  providerId?: string | null
  error?: string | null
  complete: NonNullable<SendNotificationDeps["completeDelivery"]>
  recordAudit: NonNullable<SendNotificationDeps["recordAudit"]>
}): Promise<ChannelDeliveryResult> {
  const wrote = await input.complete({
    id: input.row.id,
    runId: input.runId,
    claimedAt: input.row.claimedAt,
    status: input.status,
    providerId: input.providerId,
    error: input.error,
    now: input.now,
  })
  if (!wrote) {
    console.info("[notifications] lease taken over; skipping complete", {
      deliveryId: input.row.id,
    })
    return {
      channel: input.channel,
      deliveryId: input.row.id,
      status: "held",
      providerId: input.providerId ?? null,
    }
  }
  if (input.parsed.orgId) {
    await input.recordAudit({
      orgId: input.parsed.orgId,
      deliveryId: input.row.id,
      kind: input.parsed.kind,
      channel: input.channel,
      action: input.status,
    })
  }
  return {
    channel: input.channel,
    deliveryId: input.row.id,
    status: input.status,
    providerId: input.providerId ?? null,
  }
}

async function deliverEmail(input: {
  parsed: ParsedSend
  channel: "email"
  email: string
  row: DeliveryRow
  runId: string
  now: Date
  markAttempt: NonNullable<SendNotificationDeps["markFirstAttempt"]>
  complete: NonNullable<SendNotificationDeps["completeDelivery"]>
  persistProviderId: NonNullable<SendNotificationDeps["recordProviderId"]>
  suppressed: NonNullable<SendNotificationDeps["isEmailSuppressed"]>
  sendEmail: NonNullable<SendNotificationDeps["sendEmail"]>
  listEmails: SendNotificationDeps["listEmails"]
  getEmail: SendNotificationDeps["getEmail"]
  recordAudit: NonNullable<SendNotificationDeps["recordAudit"]>
}): Promise<ChannelDeliveryResult> {
  if (await input.suppressed(input.email)) {
    return finish({ ...input, status: "suppressed" })
  }

  if (input.row.providerId) {
    return finish({
      ...input,
      status: "sent",
      providerId: input.row.providerId,
    })
  }

  const firstAttemptAt = await input.markAttempt({
    id: input.row.id,
    runId: input.runId,
    now: input.now,
  })
  const adopted = await adoptResendDelivery({
    deliveryId: input.row.id,
    to: input.email,
    firstAttemptAt,
    now: input.now,
    listEmails: input.listEmails,
    getEmail: input.getEmail,
  })
  if (adopted) {
    await input.persistProviderId({
      id: input.row.id,
      providerId: adopted,
      now: input.now,
    })
    return finish({
      ...input,
      status: "sent",
      providerId: adopted,
    })
  }

  const sent = await input.sendEmail({
    to: input.email,
    subject: input.parsed.ctx.subject,
    html: input.parsed.ctx.html,
    deliveryId: input.row.id,
  })
  await input.persistProviderId({
    id: input.row.id,
    providerId: sent.providerId,
    now: input.now,
  })
  return finish({
    ...input,
    status: "sent",
    providerId: sent.providerId,
  })
}

async function deliverInApp(input: {
  parsed: ParsedSend
  channel: "in_app"
  userId: string | null
  row: DeliveryRow
  runId: string
  now: Date
  markAttempt: NonNullable<SendNotificationDeps["markFirstAttempt"]>
  complete: NonNullable<SendNotificationDeps["completeDelivery"]>
  inbox: NonNullable<SendNotificationDeps["insertInbox"]>
  recordAudit: NonNullable<SendNotificationDeps["recordAudit"]>
}): Promise<ChannelDeliveryResult> {
  if (!input.userId) {
    return finish({
      ...input,
      status: "failed",
      error: "in_app requires userId",
    })
  }
  await input.markAttempt({
    id: input.row.id,
    runId: input.runId,
    now: input.now,
  })
  await input.inbox({
    deliveryId: input.row.id,
    userId: input.userId,
    orgId: input.parsed.orgId ?? null,
    kind: input.parsed.kind,
    title: input.parsed.ctx.title,
    body: input.parsed.ctx.body,
    href: input.parsed.ctx.href,
    data: input.parsed.ctx.data,
  })
  return finish({ ...input, status: "sent" })
}
