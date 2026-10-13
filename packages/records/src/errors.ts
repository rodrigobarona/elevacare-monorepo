export type SessionRecordErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INTAKE_READONLY"
  | "AI_MODEL_ZERO_RETENTION_REQUIRED"

export class SessionRecordError extends Error {
  override readonly name = "SessionRecordError"

  constructor(readonly code: SessionRecordErrorCode) {
    super(code)
  }
}

export const SESSION_RECORD_KINDS = [
  "intake",
  "note",
  "transcript",
  "ai_draft",
  "internal_report",
] as const

export type SessionRecordKind = (typeof SESSION_RECORD_KINDS)[number]

export const WRITABLE_SESSION_RECORD_KINDS = [
  "note",
  "transcript",
  "internal_report",
] as const

export type WritableSessionRecordKind =
  (typeof WRITABLE_SESSION_RECORD_KINDS)[number]

export const SESSION_RECORD_TITLES: Record<SessionRecordKind, string> = {
  intake: "Pre-session notes",
  note: "Session notes",
  transcript: "Transcript",
  ai_draft: "AI summary",
  internal_report: "Internal report",
}

export function isWritableSessionRecordKind(
  kind: string
): kind is WritableSessionRecordKind {
  return (WRITABLE_SESSION_RECORD_KINDS as readonly string[]).includes(kind)
}
