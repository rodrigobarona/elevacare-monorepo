export type ElevaCallErrorCode =
  | "SESSION_NOT_OPEN"
  | "SESSION_NOT_ACTIVE"
  | "NOT_A_PARTICIPANT"
  | "ROOM_NOT_READY"
  | "internal"

export type ElevaCallLabels = {
  notHipaa: string
  prejoinTitle: string
  prejoinHint: string
  join: string
  joining: string
  waiting: string
  waitingHint: string
  mute: string
  unmute: string
  cameraOff: string
  cameraOn: string
  shareScreen: string
  stopShare: string
  chat: string
  chatPlaceholder: string
  send: string
  leave: string
  leftTitle: string
  leftBody: string
  back: string
  errorTitle: string
  retry: string
  notesTitle: string
  notesPlaceholder: string
  you: string
  remote: string
  connecting: string
  errors: Record<ElevaCallErrorCode, string>
}

export function joinErrorCode(err: unknown): ElevaCallErrorCode {
  if (err && typeof err === "object" && "body" in err) {
    const code = (err as { body?: { error?: string } }).body?.error
    if (
      code === "SESSION_NOT_OPEN" ||
      code === "SESSION_NOT_ACTIVE" ||
      code === "NOT_A_PARTICIPANT" ||
      code === "ROOM_NOT_READY"
    ) {
      return code
    }
  }
  return "internal"
}
