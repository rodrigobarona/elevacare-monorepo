import { createHmac, randomUUID } from "node:crypto"
import { neon } from "@neondatabase/serverless"
import { expect, type APIRequestContext } from "@playwright/test"
import { mintJoinGrant, type JoinGrantRole } from "@eleva/video/join-grant"
import { apiUrl } from "./auth"
import { isApprovedE2eDatabaseUrl } from "./local"

export type SmokeSession = {
  room: string
  startsAt: Date
  endsAt: Date
  scheduleRevision: number
}

function database() {
  const databaseUrl = process.env.DATABASE_URL
  if (!isApprovedE2eDatabaseUrl(databaseUrl)) {
    throw new Error(
      "video smoke requires E2E_ALLOW_DB_WRITES=1 and an approved loopback test DATABASE_URL"
    )
  }
  return neon(databaseUrl!)
}

/** Moves a booking into its join window; the slot itself is days away. */
export async function shiftBookingToJoinWindow(
  bookingId: string
): Promise<void> {
  const startsAt = new Date(Date.now() + 5 * 60_000).toISOString()
  const endsAt = new Date(Date.now() + 50 * 60_000).toISOString()
  const sql = database()
  await sql`
    UPDATE bookings SET starts_at = ${startsAt}, ends_at = ${endsAt}
    WHERE id = ${bookingId}
  `
  const rows = await sql`
    UPDATE sessions SET starts_at = ${startsAt}, ends_at = ${endsAt}
    WHERE booking_id = ${bookingId}
    RETURNING booking_id
  `
  expect(rows.length).toBe(1)
  // Free the original slot so a later smoke run can book it again.
  await sql`
    UPDATE slot_reservations SET status = 'released'
    WHERE booking_id = ${bookingId}
  `
}

export async function ensureRoom(
  request: APIRequestContext,
  bookingId: string
): Promise<SmokeSession> {
  const response = await request.post(`${apiUrl}/workflows/video-room-sweep`, {
    headers: {
      Authorization: `Bearer ${process.env.WORKFLOWS_DRAIN_SECRET ?? ""}`,
    },
  })
  expect(response.status(), await response.text()).toBe(200)
  const [row] = await database()`
    SELECT s.daily_room_name, s.starts_at, s.ends_at, b.schedule_revision
    FROM sessions s JOIN bookings b ON b.id = s.booking_id
    WHERE s.booking_id = ${bookingId}
  `
  expect(row?.daily_room_name, "room missing after sweep").toBeTruthy()
  return {
    room: row!.daily_room_name as string,
    startsAt: new Date(row!.starts_at as string),
    endsAt: new Date(row!.ends_at as string),
    scheduleRevision: row!.schedule_revision as number,
  }
}

export function joinGrant(
  bookingId: string,
  session: SmokeSession,
  role: JoinGrantRole
): Promise<string> {
  return mintJoinGrant({
    bookingId,
    role,
    endsAt: session.endsAt,
    scheduleRevision: session.scheduleRevision,
  })
}

/** The room was created for the original slot; open it for the moved one. */
export async function openDailyRoom(room: string): Promise<void> {
  const response = await fetch(`https://api.daily.co/v1/rooms/${room}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { nbf: Math.floor(Date.now() / 1000) - 60 },
    }),
  })
  expect(response.status, await response.text()).toBe(200)
}

/** Daily's own record of who was in the room, independent of Eleva. */
export async function dailyMeeting(room: string): Promise<{
  id: string
  participants: Array<{ participant_id: string; user_id: string | null }>
} | null> {
  const response = await fetch(
    `https://api.daily.co/v1/meetings?room=${encodeURIComponent(room)}&limit=1`,
    { headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` } }
  )
  expect(response.status).toBe(200)
  const body = (await response.json()) as {
    data: Array<{
      id: string
      participants: Array<{ participant_id: string; user_id: string | null }>
    }>
  }
  return body.data[0] ?? null
}

/**
 * Signs an event with the webhook secret. Daily's real deliveries go to the
 * deployed API, which a loopback run cannot receive.
 */
export async function replayDailyWebhook(
  request: APIRequestContext,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  const body = JSON.stringify({
    id: randomUUID(),
    type,
    event_ts: Date.now() / 1000,
    payload,
  })
  const timestamp = String(Date.now())
  const signature = createHmac(
    "sha256",
    Buffer.from(process.env.DAILY_WEBHOOK_SECRET ?? "", "base64")
  )
    .update(`${timestamp}.${body}`)
    .digest("base64")
  const response = await request.post(`${apiUrl}/webhooks/daily`, {
    headers: {
      "content-type": "application/json",
      "x-webhook-timestamp": timestamp,
      "x-webhook-signature": signature,
    },
    data: body,
  })
  expect(response.status(), await response.text()).toBe(200)
}

export async function loadSessionState(bookingId: string) {
  const [row] = await database()`
    SELECT status, attendance, participants FROM sessions
    WHERE booking_id = ${bookingId}
  `
  return row as {
    status: string
    attendance: string | null
    participants: unknown[]
  }
}
