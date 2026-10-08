"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useTranslations } from "next-intl"
import { createApiClient } from "@eleva/api-client"
import {
  JoinSession,
  elevaCallLabels,
  type ElevaCallLabels,
} from "@eleva/video/client"

export function JoinClient({
  bookingId,
  apiBaseUrl,
  backHref,
  grant,
}: {
  bookingId: string
  apiBaseUrl: string
  backHref: string
  grant: string
}) {
  const t = useTranslations("sessions.call")
  const labels = useMemo((): ElevaCallLabels => elevaCallLabels(t), [t])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("g")) return
    url.searchParams.delete("g")
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, "", next)
  }, [])

  const join = useCallback(() => {
    return createApiClient({ baseUrl: apiBaseUrl }).sessions.join(bookingId, {
      grant,
    })
  }, [apiBaseUrl, bookingId, grant])

  return (
    <JoinSession
      join={join}
      labels={labels}
      backHref={backHref}
      showNotesSlot={false}
    />
  )
}
