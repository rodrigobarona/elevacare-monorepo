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

/**
 * SDK-internal state read after beforeSend (dynamic sampling context) and
 * stripped before the envelope is sent, so it passes through untouched.
 */
const SDK_INTERNAL_KEYS = new Set<string>(["sdkProcessingMetadata"])

export function sanitizeSentryEvent<T extends object>(event: T): T {
  const source = event as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (SDK_INTERNAL_KEYS.has(key)) out[key] = value
    else if (SENTRY_EVENT_KEYS.has(key)) out[key] = redactPayload(value)
  }
  return out as T
}
