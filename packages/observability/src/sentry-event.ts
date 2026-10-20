import { redactPayload } from "./redaction"

/**
 * Top-level Sentry event keys we forward. Anything else is dropped so a
 * new SDK field can never carry a payload past the redaction walk.
 */
export const SENTRY_EVENT_KEYS = new Set<string>([
  "event_id",
  "timestamp",
  "start_timestamp",
  "level",
  "platform",
  "logger",
  "server_name",
  "release",
  "dist",
  "environment",
  "sdk",
  "type",
  "message",
  "exception",
  "threads",
  "breadcrumbs",
  "contexts",
  "tags",
  "extra",
  "user",
  "request",
  "transaction",
  "transaction_info",
  "spans",
  "measurements",
  "fingerprint",
  "modules",
  "debug_meta",
])

export function sanitizeSentryEvent<T extends object>(event: T): T {
  const redacted = redactPayload(event) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(redacted)) {
    if (SENTRY_EVENT_KEYS.has(key)) out[key] = value
  }
  return out as T
}
