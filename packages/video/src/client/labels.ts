export type ElevaCallErrorCode =
  | "SESSION_NOT_OPEN"
  | "SESSION_NOT_ACTIVE"
  | "NOT_A_PARTICIPANT"
  | "ROOM_NOT_READY"
  | "INVALID_GRANT"
  | "internal"

export type ElevaCallLabels = {
  callPrivacy: string
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
  shareFailed: string
  chat: string
  chatUnread: (count: number) => string
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
  intakeTitle: string
  transcriptTitle: string
  transcriptEmpty: string
  transcriptOff: string
  transcriptionOnNotice: string
  transcriptLanguage: string
  transcriptLanguageAuto: string
  transcriptLanguageEnglish: string
  transcriptDetected: (language: string) => string
  transcriptExpected: (language: string) => string
  transcriptNowAuto: string
  transcriptNowEnglish: string
  transcriptSuggestEnglish: string
  transcriptSuggestEnglishAction: string
  transcriptSuggestDismiss: string
  transcriptUnavailable: string
  transcriptMarker: (setting: string, vocabulary: string) => string
  transcriptMarkerAuto: string
  transcriptVocabularyMedical: string
  transcriptVocabularyStandard: string
  /** Display name of a language code in the viewer's UI locale. */
  languageName: (code: string) => string
  notesSaved: string
  notesSaveFailed: string
  notesTemplates: string
  notesStartFrom: (title: string) => string
  notesSaveAsTemplate: string
  notesManageTemplates: string
  notesTemplateSaved: string
  notesTemplatePhi: string
  notesTemplateApplyFailed: string
  notesTemplateSaveFailed: string
  reportTitle: string
  reportHint: string
  reportNotes: string
  reportNotesPlaceholder: string
  reportSuggestions: string
  reportSuggestionsPlaceholder: string
  reportRecommendations: string
  reportRecommendationsPlaceholder: string
  you: string
  youNamed: (name: string) => string
  remote: string
  screenShareOf: (name: string) => string
  connecting: string
  overtimeTitle: string
  overtimeBody: (closesAt: string) => string
  /** BCP 47 locale for the dates and times these screens show. */
  timeLocale: string | undefined
  waitingRoomTitle: (time: string) => string
  waitingRoomTitleLater: (dateTime: string) => string
  waitingRoomStarts: (time: string) => string
  waitingRoomKeepOpen: string
  waitingRoomCountdown: (minutes: number) => string
  waitingRoomSoon: string
  waitingRoomOpening: string
  waitingRoomTip: string
  waitingRoomManual: string
  endedTitle: string
  endedBody: string
  errors: Record<ElevaCallErrorCode, string>
}

export function languageDisplayName(code: string, locale?: string): string {
  try {
    return (
      new Intl.DisplayNames(locale ? [locale] : undefined, {
        type: "language",
      }).of(code) ?? code
    )
  } catch {
    return code
  }
}

export function elevaCallLabels(
  t: (key: string, values?: Record<string, string | number>) => string,
  options: { locale?: string } = {}
): ElevaCallLabels {
  return {
    callPrivacy: t("callPrivacy"),
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
    shareFailed: t("shareFailed"),
    chat: t("chat"),
    chatUnread: (count) => t("chatUnread", { count }),
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
    intakeTitle: t("intakeTitle"),
    transcriptTitle: t("transcriptTitle"),
    transcriptEmpty: t("transcriptEmpty"),
    transcriptOff: t("transcriptOff"),
    transcriptionOnNotice: t("transcriptionOnNotice"),
    transcriptLanguage: t("transcriptLanguage"),
    transcriptLanguageAuto: t("transcriptLanguageAuto"),
    transcriptLanguageEnglish: t("transcriptLanguageEnglish"),
    transcriptDetected: (language) => t("transcriptDetected", { language }),
    transcriptExpected: (language) => t("transcriptExpected", { language }),
    transcriptNowAuto: t("transcriptNowAuto"),
    transcriptNowEnglish: t("transcriptNowEnglish"),
    transcriptSuggestEnglish: t("transcriptSuggestEnglish"),
    transcriptSuggestEnglishAction: t("transcriptSuggestEnglishAction"),
    transcriptSuggestDismiss: t("transcriptSuggestDismiss"),
    transcriptUnavailable: t("transcriptUnavailable"),
    transcriptMarker: (setting, vocabulary) =>
      t("transcriptMarker", { setting, vocabulary }),
    transcriptMarkerAuto: t("transcriptMarkerAuto"),
    transcriptVocabularyMedical: t("transcriptVocabularyMedical"),
    transcriptVocabularyStandard: t("transcriptVocabularyStandard"),
    languageName: (code) => languageDisplayName(code, options.locale),
    notesSaved: t("notesSaved"),
    notesSaveFailed: t("notesSaveFailed"),
    notesTemplates: t("notesTemplates"),
    notesStartFrom: (title) => t("notesStartFrom", { title }),
    notesSaveAsTemplate: t("notesSaveAsTemplate"),
    notesManageTemplates: t("notesManageTemplates"),
    notesTemplateSaved: t("notesTemplateSaved"),
    notesTemplatePhi: t("notesTemplatePhi"),
    notesTemplateApplyFailed: t("notesTemplateApplyFailed"),
    notesTemplateSaveFailed: t("notesTemplateSaveFailed"),
    reportTitle: t("reportTitle"),
    reportHint: t("reportHint"),
    reportNotes: t("reportNotes"),
    reportNotesPlaceholder: t("reportNotesPlaceholder"),
    reportSuggestions: t("reportSuggestions"),
    reportSuggestionsPlaceholder: t("reportSuggestionsPlaceholder"),
    reportRecommendations: t("reportRecommendations"),
    reportRecommendationsPlaceholder: t("reportRecommendationsPlaceholder"),
    you: t("you"),
    youNamed: (name) => t("youNamed", { name }),
    remote: t("remote"),
    screenShareOf: (name) => t("screenShareOf", { name }),
    connecting: t("connecting"),
    overtimeTitle: t("overtimeTitle"),
    overtimeBody: (closesAt) => t("overtimeBody", { closesAt }),
    timeLocale: options.locale,
    waitingRoomTitle: (time) => t("waitingRoomTitle", { time }),
    waitingRoomTitleLater: (dateTime) =>
      t("waitingRoomTitleLater", { dateTime }),
    waitingRoomStarts: (time) => t("waitingRoomStarts", { time }),
    waitingRoomKeepOpen: t("waitingRoomKeepOpen"),
    waitingRoomCountdown: (minutes) => t("waitingRoomCountdown", { minutes }),
    waitingRoomSoon: t("waitingRoomSoon"),
    waitingRoomOpening: t("waitingRoomOpening"),
    waitingRoomTip: t("waitingRoomTip"),
    waitingRoomManual: t("waitingRoomManual"),
    endedTitle: t("endedTitle"),
    endedBody: t("endedBody"),
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

export function joinErrorWindow(err: unknown): {
  startsAt?: string
  opensAt?: string
  closesAt?: string
  now?: string
} {
  if (!err || typeof err !== "object" || !("body" in err)) return {}
  const body = (err as { body?: Record<string, unknown> }).body
  const text = (key: string) => {
    const value = body?.[key]
    return typeof value === "string" ? value : undefined
  }
  return {
    startsAt: text("startsAt"),
    opensAt: text("opensAt"),
    closesAt: text("closesAt"),
    now: text("now"),
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
