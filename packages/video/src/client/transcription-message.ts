export type TranscriptionLine = {
  speaker: string
  text: string
  isFinal: boolean
  /** Daily `session_id` of the person who spoke. */
  participantId?: string
  /** Language Deepgram detected for this line (`language=multi` only). */
  language?: string
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
 * Detected language from Deepgram's raw result: `languages` on the
 * alternative (sorted by word count), else the most common word language.
 */
export function detectedLanguage(rawResponse: unknown): string | null {
  const raw = asRecord(rawResponse)
  const channel = asRecord(raw?.channel)
  const alternatives = Array.isArray(channel?.alternatives)
    ? channel.alternatives
    : []
  const alternative = asRecord(alternatives[0])
  if (!alternative) return null
  if (Array.isArray(alternative.languages)) {
    const first = readString(alternative.languages[0])
    if (first) return first.toLowerCase()
  }
  if (!Array.isArray(alternative.words)) return null
  const counts = new Map<string, number>()
  let best: string | null = null
  let bestCount = 0
  for (const word of alternative.words) {
    const language = readString(asRecord(word)?.language)?.toLowerCase()
    if (!language) continue
    const count = (counts.get(language) ?? 0) + 1
    counts.set(language, count)
    if (count > bestCount) {
      best = language
      bestCount = count
    }
  }
  return best
}

/**
 * Daily `transcription-message` payloads vary by SDK version.
 * Accept nested `data` or top-level fields; ignore empty/partial noise.
 * Daily sends `participantId` rather than a name, so `resolveSpeaker`
 * maps it to the participant's display name.
 */
export function parseTranscriptionMessage(
  event: unknown,
  resolveSpeaker?: (participantId: string) => string | null
): TranscriptionLine | null {
  const root = asRecord(event)
  if (!root) return null
  const data = asRecord(root.data) ?? root
  const text = readString(data.text) ?? readString(data.transcript)
  if (!text) return null
  const participantId = readString(data.participantId) ?? undefined
  const speaker =
    readString(data.user_name) ??
    readString(data.userName) ??
    readString(data.participantName) ??
    (participantId ? resolveSpeaker?.(participantId) : null) ??
    "Speaker"
  const raw = asRecord(data.rawResponse)
  const isFinal =
    data.is_final === undefined && data.isFinal === undefined
      ? typeof raw?.is_final === "boolean"
        ? raw.is_final
        : true
      : readBool(data.is_final) || readBool(data.isFinal)
  const language = detectedLanguage(raw) ?? undefined
  return {
    speaker,
    text,
    isFinal,
    ...(participantId ? { participantId } : {}),
    ...(language ? { language } : {}),
  }
}

export function appendTranscriptLine(
  current: string,
  line: TranscriptionLine
): string {
  return appendTranscriptText(current, `${line.speaker}: ${line.text}`)
}

/**
 * Bracketed note that records which language setting and vocabulary
 * produced the lines that follow (kept inside the encrypted transcript).
 */
export function appendTranscriptMarker(current: string, note: string): string {
  return appendTranscriptText(current, `[${note}]`)
}

function appendTranscriptText(current: string, entry: string): string {
  if (!current.trim()) return entry
  return `${current.trimEnd()}\n${entry}`
}
