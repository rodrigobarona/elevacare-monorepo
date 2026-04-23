import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Correlation-ID propagation via AsyncLocalStorage.
 *
 * Every inbound request gets a correlation ID (either echoed from the
 * client-sent `x-correlation-id` header or generated fresh), stored in
 * this ALS for the duration of the request, and attached to:
 *   - every Sentry event (tags.correlation_id)
 *   - every audit_outbox row
 *   - every BetterStack log line
 *   - every outbound response as x-correlation-id
 *
 * @eleva/auth/proxy sets the id via withCorrelationId(); @eleva/audit
 * reads it via getCorrelationId(); Sentry's beforeSend hook reads it too.
 */

const als = new AsyncLocalStorage<string>()

const CORRELATION_ID_HEADER = "x-correlation-id"
const ID_LENGTH = 24

export function getCorrelationId(): string | undefined {
  return als.getStore()
}

export function withCorrelationId<T>(id: string, fn: () => T): T {
  return als.run(id, fn)
}

/**
 * Returns the header name we echo on requests and responses. Kept as a
 * function so integration tests can spy on it without module-import
 * side effects.
 */
export function correlationIdHeader(): string {
  return CORRELATION_ID_HEADER
}

/**
 * Generate a URL-safe correlation ID. 24 chars of base64url is enough
 * entropy for per-request identification without becoming a tracking
 * vector (tied to the specific request, not the user/session).
 */
export function generateCorrelationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, ID_LENGTH)
  }
  // Fallback for environments missing crypto.randomUUID (shouldn't hit
  // in Node 20+/Edge runtime, but keeps the module portable).
  let out = ""
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  for (let i = 0; i < ID_LENGTH; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
  }
  return out
}
