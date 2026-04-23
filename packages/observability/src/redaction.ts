/**
 * Redaction policy for Sentry / BetterStack payloads.
 *
 * Never emit to external log/error stores:
 * - session notes, transcripts, AI prompts (PHI)
 * - card numbers, CVC, full IBAN (PCI)
 * - patient NIF values (except as a minimum-necessary ID hash when
 *   strictly required by an admin surface \u2014 handled by audit, not logs)
 *
 * Applied as a Sentry beforeSend hook + a BetterStack transport filter.
 * Field-name based so new rules are testable without real PHI samples.
 */

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
])

/** Regex patterns applied to string values that survive field-name scrubbing. */
export const REDACTED_VALUE_PATTERNS: RegExp[] = [
  // Raw credit-card numbers (PAN, 12-19 digits with optional separators).
  /\b(?:\d[ -]?){12,19}\b/,
  // Bearer tokens / api keys of common shapes.
  /sk_(?:live|test)_[A-Za-z0-9_]{16,}/,
  /pk_(?:live|test)_[A-Za-z0-9_]{16,}/,
  /eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/, // JWT
]

const REDACTED_PLACEHOLDER = "[redacted]"

export function shouldRedactKey(key: string): boolean {
  return REDACTED_KEYS.has(key.toLowerCase().replace(/[-_.]/g, ""))
}

export function redactString(value: string): string {
  if (typeof value !== "string") return value
  for (const re of REDACTED_VALUE_PATTERNS) {
    if (re.test(value)) return REDACTED_PLACEHOLDER
  }
  return value
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
