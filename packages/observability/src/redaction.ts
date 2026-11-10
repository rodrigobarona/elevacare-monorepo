/**
 * Redaction policy for Sentry / BetterStack payloads.
 *
 * Never emit to external log/error stores:
 * - session notes, transcripts, AI prompts (PHI)
 * - card numbers, CVC, full IBAN (PCI)
 * - member NIF values (except as a minimum-necessary ID hash when
 *   strictly required by an admin surface \u2014 handled by audit, not logs)
 *
 * Applied as a Sentry beforeSend hook + a BetterStack transport filter.
 * Three layers: `Decrypted<T>` values are always redacted, field names in
 * REDACTED_KEYS are scrubbed, and strings are matched against the
 * request-scoped PHI registry plus the value patterns below.
 */

import { isDecrypted, scrubRegisteredPhi } from "./phi"

/** Field names whose values must be fully scrubbed. Case-insensitive match. */
export const REDACTED_KEYS = new Set<string>([
  "sessionnotes",
  "session_notes",
  "transcript",
  "transcripttext",
  "transcript_text",
  "aiprompt",
  "ai_prompt",
  "prompt",
  "cardnumber",
  "card_number",
  "cvc",
  "cvv",
  "iban",
  "nif",
  "taxid",
  "tax_id",
  "vatnumber",
  "vat_number",
  "password",
  "secret",
  "apikey",
  "api_key",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "encryptionkey",
  "encryption_key",
  // Clinical record and AI report content.
  "body",
  "bodyencrypted",
  "body_encrypted",
  "title",
  "titleencrypted",
  "notes",
  "intakenotes",
  "summary",
  "observations",
  "recommendations",
  "followupquestions",
  "follow_up_questions",
  "redflags",
  "red_flags",
  "disclaimer",
])

/** Regex patterns applied to string values that survive field-name scrubbing. */
export const REDACTED_VALUE_PATTERNS: RegExp[] = [
  // Raw credit-card numbers (PAN, 12-19 digits with optional separators),
  // but not the last block of a UUID ("…-a716-446655440000").
  /(?<![0-9A-Fa-f]-)\b(?:\d[ -]?){12,19}\b/,
  // Bearer tokens / api keys of common shapes.
  /sk_(?:live|test)_[A-Za-z0-9_]{16,}/,
  /pk_(?:live|test)_[A-Za-z0-9_]{16,}/,
  /eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/, // JWT
]

const REDACTED_PLACEHOLDER = "[redacted]"

/**
 * Personal data that can sit inside an otherwise useful message (a
 * database error that echoes a row, a validation message): masked in
 * place so the rest of the message still helps debugging.
 */
export const MASKED_VALUE_PATTERNS: RegExp[] = [
  // Email addresses.
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  // International phone numbers (+351 912 345 678, +351912345678).
  /\+\d[\d\s-]{7,15}\d/g,
  // Portuguese NIF / other 9-digit tax IDs standing alone.
  /\b\d{9}\b/g,
]

/**
 * Query errors (Drizzle "Failed query: … params: …") list the bound
 * values, which can be names, emails or health text. Keep the SQL, drop
 * the values.
 */
const QUERY_PARAMS = /(\bparams:)[\s\S]*$/i

export function shouldRedactKey(key: string): boolean {
  return REDACTED_KEYS.has(key.toLowerCase().replace(/[-_.]/g, ""))
}

export function redactString(value: string): string {
  if (typeof value !== "string") return value
  let out = value.replace(QUERY_PARAMS, `$1 ${REDACTED_PLACEHOLDER}`)
  for (const re of MASKED_VALUE_PATTERNS) {
    out = out.replace(re, REDACTED_PLACEHOLDER)
  }
  for (const re of REDACTED_VALUE_PATTERNS) {
    if (re.test(out)) return REDACTED_PLACEHOLDER
  }
  return scrubRegisteredPhi(out)
}

/**
 * Deep-redact an arbitrary payload. Returns a clone; does not mutate
 * the input (important for Sentry beforeSend contract).
 */
export function redactPayload<T>(payload: T): T {
  return deepRedact(payload, new WeakSet()) as T
}

function deepRedact(value: unknown, seen: WeakSet<object>): unknown {
  if (value == null) return value
  if (typeof value === "string") return redactString(value)
  if (typeof value !== "object") return value
  if (isDecrypted(value)) return REDACTED_PLACEHOLDER
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    }
  }
  if (seen.has(value as object)) return "[circular]"
  seen.add(value as object)

  if (Array.isArray(value)) {
    return value.map((v) => deepRedact(v, seen))
  }

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = shouldRedactKey(k) ? REDACTED_PLACEHOLDER : deepRedact(v, seen)
  }
  return out
}
