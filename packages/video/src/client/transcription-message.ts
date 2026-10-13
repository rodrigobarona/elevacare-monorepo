export type TranscriptionLine = {
  speaker: string
  text: string
  isFinal: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function readBool(value: unknown): boolean {
  return value === true || value === "true"
}

/**
 * Daily `transcription-message` payloads vary by SDK version.
 * Accept nested `data` or top-level fields; ignore empty/partial noise.
 */
export function parseTranscriptionMessage(
  event: unknown
): TranscriptionLine | null {
  const root = asRecord(event)
  if (!root) return null
  const data = asRecord(root.data) ?? root
  const text = readString(data.text) ?? readString(data.transcript)
  if (!text) return null
  const speaker =
    readString(data.user_name) ??
    readString(data.userName) ??
    readString(data.participantName) ??
    "Speaker"
  const isFinal =
    data.is_final === undefined && data.isFinal === undefined
      ? true
      : readBool(data.is_final) || readBool(data.isFinal)
  return { speaker, text, isFinal }
}

export function appendTranscriptLine(
  current: string,
  line: TranscriptionLine
): string {
  const entry = `${line.speaker}: ${line.text}`
  if (!current.trim()) return entry
  return `${current.trimEnd()}\n${entry}`
}
