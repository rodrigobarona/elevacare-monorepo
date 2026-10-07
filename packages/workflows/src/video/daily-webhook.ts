import { eq } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
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

export type DailyWebhookResult =
  | { status: "duplicate" }
  | { status: "ignored"; reason: string }
  | { status: "processed"; type: string }

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
  if (input.owner) return "expert"
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
  const applyStatus = shouldApplyEvent(session.lastEventAt, incoming)

  await withPlatformAudit(
    { orgId: session.orgId, actorUserId: null },
    async (tx, ctx) => {
      const [locked] = await tx
        .select({
          status: main.sessions.status,
          lastEventAt: main.sessions.lastEventAt,
          participants: main.sessions.participants,
          startedAt: main.sessions.startedAt,
          endedAt: main.sessions.endedAt,
        })
        .from(main.sessions)
        .where(eq(main.sessions.bookingId, session.bookingId))
        .for("update")
        .limit(1)
      if (!locked) {
        await ctx.emit({
          entity: "session",
          action: "joined",
          entityId: session.bookingId,
          payload: { type: parsed.type, roomName, ignored: true },
        })
        return
      }

      let status = locked.status
      let participants = locked.participants
      let startedAt = locked.startedAt
      let endedAt = locked.endedAt
      let lastEventAt = locked.lastEventAt
      const action =
        parsed.type === "meeting.started"
          ? ("started" as const)
          : parsed.type === "meeting.ended"
            ? ("ended" as const)
            : ("joined" as const)

      if (
        parsed.type === "participant.joined" ||
        parsed.type === "participant.left"
      ) {
        const userId = userIdFromPayload(parsed.payload)
        participants = appendParticipantHistory(participants, {
          role: participantRole({
            userId,
            owner: ownerFromPayload(parsed.payload),
            expertUserId: session.expertUserId,
            memberUserId: session.memberUserId,
          }),
          userId,
          at: incoming,
          kind: parsed.type === "participant.joined" ? "joined" : "left",
        })
        if (status === "ended" || status === "no_show") {
          const attendance = deriveAttendance(participants)
          const next = statusAfterAttendance(attendance)
          if (status === "no_show" && next === "ended") {
            status = "ended"
          }
        }
      }

      if (applyStatus && parsed.type === "meeting.started") {
        if (status === "scheduled" || status === "room_unresolved") {
          status = "live"
          startedAt = incoming
        }
      }

      if (applyStatus && parsed.type === "meeting.ended") {
        if (status === "scheduled" || status === "live") {
          status = statusAfterAttendance(deriveAttendance(participants))
          endedAt = incoming
        }
      }

      if (applyStatus) lastEventAt = incoming

      await tx
        .update(main.sessions)
        .set({
          status,
          participants,
          startedAt,
          endedAt,
          lastEventAt,
          ...(status === "ended" || status === "no_show"
            ? { attendance: deriveAttendance(participants) }
            : {}),
        })
        .where(eq(main.sessions.bookingId, session.bookingId))

      await ctx.emit({
        entity: "session",
        action,
        entityId: session.bookingId,
        payload: {
          type: parsed.type,
          roomName,
        },
      })
    }
  )

  await markProcessed(parsed.id)
  return { status: "processed", type: parsed.type }
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
