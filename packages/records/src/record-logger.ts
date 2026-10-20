import { redactString } from "@eleva/observability"

/**
 * The only logger record and document code may use. Its payload type is
 * an allow-list of scalar metadata; anything else is dropped at runtime,
 * so a record body, transcript or decrypted value can never be logged by
 * passing the wrong object.
 */
export type RecordLogFields = {
  recordId?: string
  documentId?: string
  kind?: string
  orgId?: string
  bookingId?: string
  status?: string
  modelId?: string
  tokenCount?: number
  durationMs?: number
}

const STRING_KEYS = [
  "recordId",
  "documentId",
  "kind",
  "orgId",
  "bookingId",
  "status",
  "modelId",
] as const
const NUMBER_KEYS = ["tokenCount", "durationMs"] as const

export function pickRecordLogFields(fields: unknown): RecordLogFields {
  if (!fields || typeof fields !== "object") return {}
  const source = fields as Record<string, unknown>
  const out: RecordLogFields = {}
  for (const key of STRING_KEYS) {
    const value = source[key]
    if (typeof value === "string") out[key] = redactString(value)
  }
  for (const key of NUMBER_KEYS) {
    const value = source[key]
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value
  }
  return out
}

/** Error class name and code only; messages can embed record content. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return typeof err
  const code = (err as { code?: unknown }).code
  return typeof code === "string" || typeof code === "number"
    ? `${err.name}:${code}`
    : err.name
}

type Level = "info" | "warn" | "error"

function emit(level: Level, event: string, fields?: RecordLogFields): void {
  const line = `[records] ${redactString(event)}`
  const safe = pickRecordLogFields(fields)
  if (level === "error") console.error(line, safe)
  else if (level === "warn") console.warn(line, safe)
  else console.info(line, safe)
}

export const recordLogger = {
  info: (event: string, fields?: RecordLogFields) =>
    emit("info", event, fields),
  warn: (event: string, fields?: RecordLogFields) =>
    emit("warn", event, fields),
  error: (event: string, fields?: RecordLogFields) =>
    emit("error", event, fields),
}
