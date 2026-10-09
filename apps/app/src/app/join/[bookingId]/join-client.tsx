"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { createApiClient } from "@eleva/api-client"
import { PageHeader } from "@eleva/ui/components/page-header"
import { LinkButton } from "@eleva/ui/components/button"
import {
  JoinSession,
  elevaCallLabels,
  joinErrorCode,
  type ElevaCallLabels,
} from "@eleva/video/client"
import {
  clearJoinGrant,
  readJoinGrant,
  stripJoinGrantFromUrl,
  writeJoinGrant,
} from "@/lib/join-grant-storage"

export function PublicJoinPageClient({
  bookingId,
  apiBaseUrl,
  backHref,
  grantFromUrl,
}: {
  bookingId: string
  apiBaseUrl: string
  backHref: string
  grantFromUrl: string | null
}) {
  const t = useTranslations("sessions")
  const [ready, setReady] = useState(Boolean(grantFromUrl))
  const [grant, setGrant] = useState<string | null>(grantFromUrl)

  useEffect(() => {
    if (grantFromUrl) {
      writeJoinGrant(bookingId, grantFromUrl)
      stripJoinGrantFromUrl()
      setGrant(grantFromUrl)
      setReady(true)
      return
    }
    setGrant(readJoinGrant(bookingId))
    setReady(true)
  }, [bookingId, grantFromUrl])

  const clearStoredGrant = useCallback(() => {
    clearJoinGrant(bookingId)
  }, [bookingId])

  if (!ready) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t("call.connecting")}
      </p>
    )
  }

  if (!grant) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <PageHeader title={t("join")} description={t("joinMissingGrant")} />
        <LinkButton href={backHref}>{t("call.back")}</LinkButton>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-12">
      <PageHeader title={t("join")} />
      <JoinClient
        bookingId={bookingId}
        apiBaseUrl={apiBaseUrl}
        backHref={backHref}
        grant={grant}
        onInvalidGrant={clearStoredGrant}
      />
    </div>
  )
}

function JoinClient({
  bookingId,
  apiBaseUrl,
  backHref,
  grant,
  onInvalidGrant,
}: {
  bookingId: string
  apiBaseUrl: string
  backHref: string
  grant: string
  onInvalidGrant: () => void
}) {
  const t = useTranslations("sessions.call")
  const labels = useMemo((): ElevaCallLabels => elevaCallLabels(t), [t])

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: apiBaseUrl,
        credentials: "omit",
      }),
    [apiBaseUrl]
  )

  const join = useCallback(async () => {
    try {
      return await api.sessions.join(bookingId, {
        grant,
      })
    } catch (err) {
      if (joinErrorCode(err) === "INVALID_GRANT") {
        onInvalidGrant()
      }
      throw err
    }
  }, [api, bookingId, grant, onInvalidGrant])

  return (
    <JoinSession
      join={join}
      labels={labels}
      backHref={backHref}
      showNotesSlot={false}
    />
  )
}
