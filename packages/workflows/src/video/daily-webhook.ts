import { eq } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { main, withPlatformAdminContext, type Tx } from "@eleva/db"
import {
  parseDailyWebhookEvent,
  verifyDailyWebhook,
} from "@eleva/video/webhooks"
import {
  appendParticipantHistory,
  deriveAttendance,
  eventTimeFromDaily,
  shouldApplyEvent,
  statusAfterAttendance,
  type SessionParticipantHistory,
} from "./attendance"

const SUPPORTED_WEBHOOK_TYPES = new Set([
  "meeting.started",
  "meeting.ended",
  "participant.joined",
  "participant.left",
])

export type DailyWebhookResult =
  | { status: "duplicate" }
  | { status: "ignored"; reason: string }
  | { status: "processed"; type: string }

export function webhookEventWriteGate(
  processedAt: Date | null | undefined
): "duplicate" | "proceed" {
  return processedAt ? "duplicate" : "proceed"
}

export function webhookAuditAction(type: string): "started" | "ended" | null {
  if (type === "meeting.started") return "started"
  if (type === "meeting.ended") return "ended"
  return null
}

export class DailyWebhookAuthError extends Error {
  override readonly name = "DailyWebhookAuthError"
  constructor() {
    super("invalid_signature")
  }
}

function roomNameFromPayload(payload: Record<string, unknown> | undefined) {
  const room = payload?.room
  return typeof room === "string" && room.length > 0 ? room : null
}

function userIdFromPayload(payload: Record<string, unknown> | undefined) {
  const userId = payload?.user_id
  return typeof userId === "string" && userId.length > 0 ? userId : undefined
}

function ownerFromPayload(payload: Record<string, unknown> | undefined) {
  return payload?.owner === true
}

function participantRole(input: {
  userId?: string
  owner: boolean
  expertUserId: string | null
  memberUserId: string | null
}): SessionParticipantHistory["role"] {
  if (input.userId && input.userId === input.expertUserId) return "expert"
  if (input.userId && input.userId === input.memberUserId) return "member"
  if (input.owner && input.userId) return "expert"
  return "delegate"
}

export async function handleDailyWebhook(input: {
  timestamp: string | null
  signature: string | null
  body: string
  secret?: string
}): Promise<DailyWebhookResult> {
  const secret = input.secret ?? process.env.DAILY_WEBHOOK_SECRET
  if (
    !secret ||
    !verifyDailyWebhook({
      timestamp: input.timestamp,
      signature: input.signature,
      body: input.body,
      secret,
    })
  ) {
    throw new DailyWebhookAuthError()
  }

  let parsed: ReturnType<typeof parseDailyWebhookEvent>
  try {
    parsed = parseDailyWebhookEvent(JSON.parse(input.body) as unknown)
  } catch {
    return { status: "ignored", reason: "invalid_payload" }
  }
  if (!parsed.id) return { status: "ignored", reason: "missing_event_id" }
  if (parsed.type === "error") {
    return { status: "ignored", reason: "error_event" }
  }
  if (!SUPPORTED_WEBHOOK_TYPES.has(parsed.type)) {
    return { status: "ignored", reason: "unsupported_type" }
  }

  const claimed = await withPlatformAdminContext(async (tx) => {
    const inserted = await tx
      .insert(main.dailyWebhookEvents)
      .values({
        eventId: parsed.id!,
        type: parsed.type,
        payload: (parsed.payload ?? {}) as Record<string, unknown>,
      })
      .onConflictDoNothing()
      .returning({ eventId: main.dailyWebhookEvents.eventId })
    if (inserted.length > 0) return "claim" as const
    const [existing] = await tx
      .select({ processedAt: main.dailyWebhookEvents.processedAt })
      .from(main.dailyWebhookEvents)
      .where(eq(main.dailyWebhookEvents.eventId, parsed.id!))
      .limit(1)
    if (existing?.processedAt) return "duplicate" as const
    return "retry" as const
  })
  if (claimed === "duplicate") return { status: "duplicate" }

  const roomName = roomNameFromPayload(parsed.payload)
  if (!roomName) {
    await markProcessed(parsed.id)
    return { status: "ignored", reason: "missing_room" }
  }

  const session = await withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        bookingId: main.sessions.bookingId,
        orgId: main.sessions.orgId,
        status: main.sessions.status,
        lastEventAt: main.sessions.lastEventAt,
        participants: main.sessions.participants,
        memberUserId: main.sessions.memberUserId,
        expertUserId: main.expertProfiles.userId,
      })
      .from(main.sessions)
      .innerJoin(
        main.expertProfiles,
        eq(main.expertProfiles.id, main.sessions.expertProfileId)
      )
      .where(eq(main.sessions.dailyRoomName, roomName))
      .limit(1)
    return row ?? null
  })

  if (!session) {
    await markProcessed(parsed.id)
    return { status: "ignored", reason: "unknown_room" }
  }

  const now = new Date()
  const incoming = eventTimeFromDaily(parsed.event_ts, now)

  const auditAction = webhookAuditAction(parsed.type)
  const applied = auditAction
    ? await applyLifecycleWebhook({
        eventId: parsed.id,
        bookingId: session.bookingId,
        orgId: session.orgId,
        roomName,
        type: parsed.type,
        action: auditAction,
        incoming,
      })
    : await applyParticipantWebhook({
        eventId: parsed.id,
        bookingId: session.bookingId,
        orgId: session.orgId,
        roomName,
        type: parsed.type,
        incoming,
        payload: parsed.payload,
        expertUserId: session.expertUserId,
        memberUserId: session.memberUserId,
      })

  if (applied === "duplicate") return { status: "duplicate" }
  if (!applied) {
    await markProcessed(parsed.id)
    return { status: "ignored", reason: "session_gone" }
  }

  return { status: "processed", type: parsed.type }
}

class WebhookSessionGone extends Error {
  override readonly name = "WebhookSessionGone"
}

class WebhookEventDuplicate extends Error {
  override readonly name = "WebhookEventDuplicate"
}

async function lockWebhookEventForWrite(tx: Tx, eventId: string) {
  const [event] = await tx
    .select({ processedAt: main.dailyWebhookEvents.processedAt })
    .from(main.dailyWebhookEvents)
    .where(eq(main.dailyWebhookEvents.eventId, eventId))
    .for("update")
    .limit(1)
  if (!event) throw new Error("webhook_event_missing")
  if (webhookEventWriteGate(event.processedAt) === "duplicate") {
    throw new WebhookEventDuplicate()
  }
}

async function markProcessedInTx(tx: Tx, eventId: string) {
  await tx
    .update(main.dailyWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(main.dailyWebhookEvents.eventId, eventId))
}

async function applyLifecycleWebhook(input: {
  eventId: string
  bookingId: string
  orgId: string
  roomName: string
  type: string
  action: "started" | "ended"
  incoming: Date
}): Promise<boolean | "duplicate"> {
  try {
    await withPlatformAudit(
      { orgId: input.orgId, actorUserId: null },
      async (tx, ctx) => {
        await lockWebhookEventForWrite(tx, input.eventId)
        const [locked] = await tx
          .select({
            status: main.sessions.status,
            lastEventAt: main.sessions.lastEventAt,
            participants: main.sessions.participants,
            startedAt: main.sessions.startedAt,
            endedAt: main.sessions.endedAt,
          })
          .from(main.sessions)
          .where(eq(main.sessions.bookingId, input.bookingId))
          .for("update")
          .limit(1)
        if (!locked) throw new WebhookSessionGone()

        let status = locked.status
        let startedAt = locked.startedAt
        let endedAt = locked.endedAt
        let lastEventAt = locked.lastEventAt
        const applyStatus = shouldApplyEvent(locked.lastEventAt, input.incoming)

        if (applyStatus && input.type === "meeting.started") {
          if (status === "scheduled" || status === "room_unresolved") {
            status = "live"
            startedAt = input.incoming
          }
        }

        if (applyStatus && input.type === "meeting.ended") {
          if (status === "scheduled" || status === "live") {
            status = statusAfterAttendance(
              deriveAttendance(locked.participants)
            )
            endedAt = input.incoming
          }
        }

        if (applyStatus) lastEventAt = input.incoming

        await tx
          .update(main.sessions)
          .set({
            status,
            startedAt,
            endedAt,
            lastEventAt,
            ...(status === "ended" || status === "no_show"
              ? { attendance: deriveAttendance(locked.participants) }
              : {}),
          })
          .where(eq(main.sessions.bookingId, input.bookingId))

        await markProcessedInTx(tx, input.eventId)
        await ctx.emit({
          entity: "session",
          action: input.action,
          entityId: input.bookingId,
          payload: { type: input.type, roomName: input.roomName },
        })
      }
    )
    return true
  } catch (err) {
    if (err instanceof WebhookEventDuplicate) return "duplicate"
    if (err instanceof WebhookSessionGone) return false
    throw err
  }
}

type SessionStatus = (typeof main.sessions.$inferSelect)["status"]

function nextParticipantState(input: {
  status: SessionStatus
  participants: SessionParticipantHistory[]
  payload: Record<string, unknown> | undefined
  incoming: Date
  type: string
  expertUserId: string | null
  memberUserId: string | null
}) {
  const userId = userIdFromPayload(input.payload)
  const participants = appendParticipantHistory(input.participants, {
    role: participantRole({
      userId,
      owner: ownerFromPayload(input.payload),
      expertUserId: input.expertUserId,
      memberUserId: input.memberUserId,
    }),
    userId,
    at: input.incoming,
    kind: input.type === "participant.joined" ? "joined" : "left",
  })
  let status = input.status
  if (status === "no_show") {
    const next = statusAfterAttendance(deriveAttendance(participants))
    if (next === "ended") status = "ended"
  }
  return {
    status,
    participants,
    corrected: input.status === "no_show" && status === "ended",
  }
}

async function applyParticipantWebhook(input: {
  eventId: string
  bookingId: string
  orgId: string
  roomName: string
  type: string
  incoming: Date
  payload: Record<string, unknown> | undefined
  expertUserId: string | null
  memberUserId: string | null
}): Promise<boolean | "duplicate"> {
  try {
    await withPlatformAudit(
      { orgId: input.orgId, actorUserId: null },
      async (tx, ctx) => {
        await lockWebhookEventForWrite(tx, input.eventId)
        const [locked] = await tx
          .select({
            status: main.sessions.status,
            lastEventAt: main.sessions.lastEventAt,
            participants: main.sessions.participants,
          })
          .from(main.sessions)
          .where(eq(main.sessions.bookingId, input.bookingId))
          .for("update")
          .limit(1)
        if (!locked) throw new WebhookSessionGone()
        const next = nextParticipantState({
          ...input,
          status: locked.status,
          participants: locked.participants,
        })
        await tx
          .update(main.sessions)
          .set({
            status: next.status,
            participants: next.participants,
            ...(next.status === "ended" || next.status === "no_show"
              ? { attendance: deriveAttendance(next.participants) }
              : {}),
          })
          .where(eq(main.sessions.bookingId, input.bookingId))
        await markProcessedInTx(tx, input.eventId)
        await ctx.emit({
          entity: "session",
          action: next.corrected ? "attendance_corrected" : "history_recorded",
          entityId: input.bookingId,
          payload: { type: input.type, roomName: input.roomName },
        })
      }
    )
    return true
  } catch (err) {
    if (err instanceof WebhookEventDuplicate) return "duplicate"
    if (err instanceof WebhookSessionGone) return false
    throw err
  }
}

async function markProcessed(eventId: string) {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.dailyWebhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(main.dailyWebhookEvents.eventId, eventId))
  })
}

export function dailyWebhookHeaders(request: Request) {
  return {
    timestamp:
      request.headers.get("x-webhook-timestamp") ??
      request.headers.get("x-daily-timestamp"),
    signature:
      request.headers.get("x-webhook-signature") ??
      request.headers.get("x-daily-signature"),
  }
}
