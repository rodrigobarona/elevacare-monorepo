export type ElevaCallErrorCode =
  | "SESSION_NOT_OPEN"
  | "SESSION_NOT_ACTIVE"
  | "NOT_A_PARTICIPANT"
  | "ROOM_NOT_READY"
  | "INVALID_GRANT"
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

export function elevaCallLabels(t: (key: string) => string): ElevaCallLabels {
  return {
    notHipaa: t("notHipaa"),
    prejoinTitle: t("prejoinTitle"),
    prejoinHint: t("prejoinHint"),
    join: t("join"),
    joining: t("joining"),
    waiting: t("waiting"),
    waitingHint: t("waitingHint"),
    mute: t("mute"),
    unmute: t("unmute"),
    cameraOff: t("cameraOff"),
    cameraOn: t("cameraOn"),
    shareScreen: t("shareScreen"),
    stopShare: t("stopShare"),
    chat: t("chat"),
    chatPlaceholder: t("chatPlaceholder"),
    send: t("send"),
    leave: t("leave"),
    leftTitle: t("leftTitle"),
    leftBody: t("leftBody"),
    back: t("back"),
    errorTitle: t("errorTitle"),
    retry: t("retry"),
    notesTitle: t("notesTitle"),
    notesPlaceholder: t("notesPlaceholder"),
    you: t("you"),
    remote: t("remote"),
    connecting: t("connecting"),
    errors: {
      SESSION_NOT_OPEN: t("errors.SESSION_NOT_OPEN"),
      SESSION_NOT_ACTIVE: t("errors.SESSION_NOT_ACTIVE"),
      NOT_A_PARTICIPANT: t("errors.NOT_A_PARTICIPANT"),
      ROOM_NOT_READY: t("errors.ROOM_NOT_READY"),
      INVALID_GRANT: t("errors.INVALID_GRANT"),
      internal: t("errors.internal"),
    },
  }
}

export function joinErrorCode(err: unknown): ElevaCallErrorCode {
  if (err && typeof err === "object" && "body" in err) {
    const code = (err as { body?: { error?: string } }).body?.error
    if (
      code === "SESSION_NOT_OPEN" ||
      code === "SESSION_NOT_ACTIVE" ||
      code === "NOT_A_PARTICIPANT" ||
      code === "ROOM_NOT_READY" ||
      code === "INVALID_GRANT"
    ) {
      return code
    }
  }
  return "internal"
}
