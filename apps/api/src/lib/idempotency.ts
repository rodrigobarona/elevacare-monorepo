import { createHash } from "node:crypto"
import type { Redis } from "@upstash/redis"
import { getBookingRedis } from "./booking-redis"
import { secureJson } from "./security-headers"

/**
 * `Idempotency-Key` support for non-refund mutations (bookings, payments).
 *
 * Semantics (Stripe-style, simplified):
 * - Header absent: the request runs normally.
 * - Same actor + key + body: a finished 2xx result is replayed verbatim with
 *   `Idempotent-Replayed: true`; an in-flight duplicate gets 409
 *   `IDEMPOTENCY_IN_PROGRESS`.
 * - Same actor + key, different body: 422 `IDEMPOTENCY_KEY_REUSED`.
 * - Non-2xx results and thrown errors release the key so the caller can retry.
 * - Redis unavailable: the request runs without idempotency (routes that need
 *   Redis for their own state already fail closed).
 */

export const IDEMPOTENCY_HEADER = "Idempotency-Key"
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_:.-]{8,128}$/
const PENDING_TTL_SECONDS = 60
// Stored bodies can carry short-lived secrets (reservation token, Stripe
// client secret), so results are kept for one hour rather than a day.
const RESULT_TTL_SECONDS = 60 * 60

type StoredEntry =
  | { state: "pending"; fingerprint: string }
  | {
      state: "done"
      fingerprint: string
      status: number
      body: string
      contentType: string
    }

export interface IdempotencyContext {
  /** Route namespace, e.g. `bookings.reserve`. */
  scope: string
  /** Authenticated user id, or the rate-limit key for anonymous callers. */
  actor: string
  /** CORS headers merged into idempotency error responses. */
  headers: Record<string, string>
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function replay(
  entry: Extract<StoredEntry, { state: "done" }>,
  headers: Record<string, string>
) {
  return new Response(entry.body, {
    status: entry.status,
    headers: {
      ...headers,
      "Content-Type": entry.contentType,
      "Cache-Control": "no-store",
      "Idempotent-Replayed": "true",
    },
  })
}

async function release(redis: Redis, storageKey: string): Promise<void> {
  try {
    await redis.del(storageKey)
  } catch (err) {
    console.error("[idempotency] failed to release key", err)
  }
}

export async function withIdempotency(
  request: Request,
  context: IdempotencyContext,
  run: () => Promise<Response>,
  redis: Redis | null = getBookingRedis()
): Promise<Response> {
  const rawKey = request.headers.get(IDEMPOTENCY_HEADER)
  if (rawKey === null) return run()

  const key = rawKey.trim()
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return secureJson(
      { error: "validation", code: "IDEMPOTENCY_KEY_INVALID" },
      { status: 422, headers: context.headers }
    )
  }
  if (!redis) return run()

  const fingerprint = digest(await request.clone().text())
  const storageKey = `idem:${context.scope}:${digest(`${context.actor}:${key}`)}`

  let claimed: unknown
  try {
    claimed = await redis.set<StoredEntry>(
      storageKey,
      { state: "pending", fingerprint },
      { nx: true, ex: PENDING_TTL_SECONDS }
    )
  } catch (err) {
    console.error("[idempotency] claim failed, running without it", err)
    return run()
  }

  if (claimed === null) {
    const existing = await redis.get<StoredEntry>(storageKey).catch(() => null)
    if (existing && existing.fingerprint !== fingerprint) {
      return secureJson(
        { error: "unprocessable", code: "IDEMPOTENCY_KEY_REUSED" },
        { status: 422, headers: context.headers }
      )
    }
    if (existing?.state === "done") return replay(existing, context.headers)
    return secureJson(
      { error: "conflict", code: "IDEMPOTENCY_IN_PROGRESS" },
      { status: 409, headers: { ...context.headers, "Retry-After": "1" } }
    )
  }

  let response: Response
  try {
    response = await run()
  } catch (err) {
    await release(redis, storageKey)
    throw err
  }

  if (response.status < 200 || response.status >= 300) {
    await release(redis, storageKey)
    return response
  }

  // The mutation already committed: storing the replay entry is best effort so
  // a Redis failure never turns a success into a 500 (the pending claim then
  // simply expires).
  try {
    await redis.set<StoredEntry>(
      storageKey,
      {
        state: "done",
        fingerprint,
        status: response.status,
        body: await response.clone().text(),
        contentType: response.headers.get("Content-Type") ?? "application/json",
      },
      { ex: RESULT_TTL_SECONDS }
    )
  } catch (err) {
    console.error("[idempotency] failed to persist result", err)
  }
  return response
}
