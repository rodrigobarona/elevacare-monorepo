"use client"

import { useCallback, useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
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
  showNotesSlot = false,
}: {
  bookingId: string
  apiBaseUrl: string
  backHref: string
  showNotesSlot?: boolean
}) {
  const t = useTranslations("sessions.call")
  const locale = useLocale()
  const labels = useMemo(
    (): ElevaCallLabels => elevaCallLabels(t, { locale }),
    [t, locale]
  )

  const join = useCallback(() => {
    return createApiClient({ baseUrl: apiBaseUrl }).sessions.join(bookingId)
  }, [apiBaseUrl, bookingId])

  return (
    <JoinSession
      join={join}
      labels={labels}
      backHref={backHref}
      showNotesSlot={showNotesSlot}
    />
  )
}
