import {
  PublicEventTypeDetailSchema,
  PublicSlotsResponseSchema,
} from "@eleva/api-client"

export const BOOKING_PROBE_EXPERT = "fisiomota"
export const BOOKING_PROBE_EVENT_SLUG = "first-visit"
export const BOOKING_PROBE_TZ = "Europe/Lisbon"
export const BOOKING_PROBE_FAKE_RESERVATION_ID =
  "00000000-0000-4000-8000-000000000001"
export const BOOKING_PROBE_FAKE_TOKEN = "booking-probe-token"

const PROBE_TIMEOUT_MS = 10_000
const SLOTS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export type BookingProbeName = "slots" | "intent"

export type BookingProbeCheck = {
  name: BookingProbeName
  ok: boolean
  status?: number
  durationMs: number
  error?: string
  blockedByBotId?: boolean
}

export type BookingProbeReport = {
  ok: boolean
  checks: BookingProbeCheck[]
}

type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status" | "json">>

async function timedCheck(
  name: BookingProbeName,
  fn: () => Promise<Omit<BookingProbeCheck, "name" | "durationMs">>
): Promise<BookingProbeCheck> {
  const startedAt = Date.now()
  try {
    const result = await fn()
    return { name, durationMs: Date.now() - startedAt, ...result }
  } catch (err) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function apiUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.replace(/\/$/, "")}/`).toString()
}

async function probeSlots(
  baseUrl: string,
  fetchImpl: FetchLike,
  now: Date
): Promise<Omit<BookingProbeCheck, "name" | "durationMs">> {
  const offerRes = await fetchImpl(
    apiUrl(
      baseUrl,
      `/public/experts/${BOOKING_PROBE_EXPERT}/event-types/${BOOKING_PROBE_EVENT_SLUG}`
    ),
    { method: "GET", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) }
  )
  if (offerRes.status !== 200) {
    return {
      ok: false,
      status: offerRes.status,
      error: `offer ${offerRes.status}`,
    }
  }

  const offer = PublicEventTypeDetailSchema.safeParse(await offerRes.json())
  if (!offer.success) {
    return { ok: false, status: offerRes.status, error: "offer schema" }
  }

  const mode =
    offer.data.modes.find((item) => item.mode === "online") ??
    offer.data.modes[0]
  if (!mode) {
    return { ok: false, status: offerRes.status, error: "offer has no modes" }
  }

  const from = now.toISOString()
  const to = new Date(now.getTime() + SLOTS_WINDOW_MS).toISOString()
  const slotsPath = `/public/experts/${BOOKING_PROBE_EXPERT}/event-types/${BOOKING_PROBE_EVENT_SLUG}/slots?modeId=${mode.id}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&tz=${encodeURIComponent(BOOKING_PROBE_TZ)}`
  const slotsRes = await fetchImpl(apiUrl(baseUrl, slotsPath), {
    method: "GET",
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  })
  if (slotsRes.status !== 200) {
    return {
      ok: false,
      status: slotsRes.status,
      error: `slots ${slotsRes.status}`,
    }
  }

  const slots = PublicSlotsResponseSchema.safeParse(await slotsRes.json())
  if (!slots.success) {
    return { ok: false, status: slotsRes.status, error: "slots schema" }
  }

  return { ok: true, status: slotsRes.status }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isIntentNotFoundBody(body: unknown): boolean {
  return isRecord(body) && body.error === "not_found"
}

function isIntentValidationBody(body: unknown): boolean {
  return isRecord(body) && body.error === "validation"
}

async function probeIntent(
  baseUrl: string,
  fetchImpl: FetchLike
): Promise<Omit<BookingProbeCheck, "name" | "durationMs">> {
  const intentRes = await fetchImpl(apiUrl(baseUrl, "/payments/intent"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      reservationId: BOOKING_PROBE_FAKE_RESERVATION_ID,
      reservationToken: BOOKING_PROBE_FAKE_TOKEN,
    }),
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  })
  const body = await intentRes.json().catch(() => null)

  if (intentRes.status === 403) {
    return {
      ok: false,
      status: 403,
      blockedByBotId: true,
      error: "botid",
    }
  }

  if (intentRes.status === 404 && isIntentNotFoundBody(body)) {
    return { ok: true, status: 404 }
  }

  if (intentRes.status === 422 && isIntentValidationBody(body)) {
    return { ok: true, status: 422 }
  }

  return {
    ok: false,
    status: intentRes.status,
    error: `intent ${intentRes.status}`,
  }
}

/**
 * HTTP probes for the public booking funnel on staging.
 *
 * Slots: seeded `fisiomota/first-visit` offer then a 7-day availability
 * window. An empty slot list is healthy (schema + 200).
 *
 * Intent: POST a fake reservation. Healthy only when the handler
 * returns 404 `{ error: "not_found" }` or 422 `{ error: "validation" }`
 * — a bare route-level 404 is a miss. 403 is BotID rejecting the
 * server-side POST; callers may recover via the domain function.
 */
export async function runBookingFunnelProbes(options: {
  baseUrl: string
  fetchImpl?: FetchLike
  now?: Date
}): Promise<BookingProbeReport> {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? new Date()

  const checks = await Promise.all([
    timedCheck("slots", () => probeSlots(options.baseUrl, fetchImpl, now)),
    timedCheck("intent", () => probeIntent(options.baseUrl, fetchImpl)),
  ])

  return { ok: checks.every((check) => check.ok), checks }
}

export function recoverIntentCheck(
  check: BookingProbeCheck,
  domainError: string
): BookingProbeCheck {
  if (check.name !== "intent" || !check.blockedByBotId) {
    return check
  }

  if (domainError === "not_found") {
    return { ...check, ok: true, error: undefined }
  }

  return { ...check, ok: false, error: `domain_fallback:${domainError}` }
}
