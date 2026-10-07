"use client"

import { useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"
import { createApiClient } from "@eleva/api-client"
import { JoinSession, type ElevaCallLabels } from "@eleva/video/client"

export function JoinClient({
  bookingId,
  apiBaseUrl,
  backHref,
}: {
  bookingId: string
  apiBaseUrl: string
  backHref: string
}) {
  const t = useTranslations("sessions.call")
  const labels = useMemo((): ElevaCallLabels => {
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
        internal: t("errors.internal"),
      },
    }
  }, [t])

  const join = useCallback(() => {
    return createApiClient({ baseUrl: apiBaseUrl }).sessions.join(bookingId)
  }, [apiBaseUrl, bookingId])

  return (
    <JoinSession
      join={join}
      labels={labels}
      backHref={backHref}
      showNotesSlot
    />
  )
}
