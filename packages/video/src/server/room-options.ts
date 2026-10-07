export const ROOM_NAME_PREFIX = "eleva-"
export const JOIN_LEAD_MS = 15 * 60 * 1000
export const JOIN_TRAIL_MS = 30 * 60 * 1000

export type DailyLang = "en" | "pt" | "es"

export type CreateSessionRoomInput = {
  bookingId: string
  startAt: Date
  endAt: Date
  extraParticipants?: number
  lang?: DailyLang
}

export type SessionRoomProperties = {
  nbf: number
  exp: number
  max_participants: number
  enable_prejoin_ui: true
  enable_chat: true
  enable_screenshare: true
  enable_recording: false
  enable_recording_ui: false
  start_cloud_recording: false
  eject_at_room_exp: true
  enable_knocking: false
  lang: DailyLang
}

export type SessionRoomCreateBody = {
  name: string
  privacy: "private"
  properties: SessionRoomProperties
}

const BOOKING_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function roomNameForBooking(bookingId: string): string {
  if (!BOOKING_ID_RE.test(bookingId)) {
    throw new Error("bookingId must be a UUID")
  }
  return `${ROOM_NAME_PREFIX}${bookingId.toLowerCase()}`
}

export function isElevaRoomName(name: string): boolean {
  return name.startsWith(ROOM_NAME_PREFIX)
}

export function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

export function buildSessionRoomBody(
  input: CreateSessionRoomInput
): SessionRoomCreateBody {
  const extra = input.extraParticipants ?? 0
  if (extra < 0 || !Number.isInteger(extra)) {
    throw new Error("extraParticipants must be a non-negative integer")
  }
  if (
    !Number.isFinite(input.startAt.getTime()) ||
    !Number.isFinite(input.endAt.getTime())
  ) {
    throw new Error("startAt and endAt must be valid dates")
  }
  if (input.endAt.getTime() <= input.startAt.getTime()) {
    throw new Error("endAt must be after startAt")
  }

  return {
    name: roomNameForBooking(input.bookingId),
    privacy: "private",
    properties: {
      nbf: unixSeconds(new Date(input.startAt.getTime() - JOIN_LEAD_MS)),
      exp: unixSeconds(new Date(input.endAt.getTime() + JOIN_TRAIL_MS)),
      max_participants: 2 + extra,
      enable_prejoin_ui: true,
      enable_chat: true,
      enable_screenshare: true,
      enable_recording: false,
      enable_recording_ui: false,
      start_cloud_recording: false,
      eject_at_room_exp: true,
      enable_knocking: false,
      lang: input.lang ?? "pt",
    },
  }
}

export function tokenExpUnix(now: Date, endAt: Date): number {
  const twoHours = unixSeconds(new Date(now.getTime() + 2 * 60 * 60 * 1000))
  const windowEnd = unixSeconds(new Date(endAt.getTime() + JOIN_TRAIL_MS))
  return Math.min(twoHours, windowEnd)
}

export function roomUrlFor(name: string, domain: string): string {
  const host = domain.includes(".") ? domain : `${domain}.daily.co`
  return `https://${host}/${name}`
}

export function roomMatchesContract(
  room: {
    privacy?: string
    config?: {
      nbf?: number
      exp?: number
      max_participants?: number
      enable_recording?: unknown
      enable_recording_ui?: boolean
      eject_at_room_exp?: boolean
    }
  },
  expected: SessionRoomProperties
): boolean {
  if (room.privacy !== "private") return false
  const config = room.config
  if (!config) return false
  if (config.nbf !== expected.nbf) return false
  if (config.exp !== expected.exp) return false
  if (config.max_participants !== expected.max_participants) return false
  if (config.eject_at_room_exp !== true) return false
  if (config.enable_recording) return false
  if (config.enable_recording_ui) return false
  return true
}
