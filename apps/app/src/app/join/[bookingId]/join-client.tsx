"use client"

import { useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"
import { createApiClient } from "@eleva/api-client"
import { PageHeader } from "@eleva/ui/components/page-header"
import { LinkButton } from "@eleva/ui/components/button"
import {
  JoinSession,
  elevaCallLabels,
  type ElevaCallLabels,
} from "@eleva/video/client"

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
  // Keep `g` on the URL so refresh still works. Do not copy the bearer into
  // sessionStorage (same-origin XSS). The email/ICS already carried this grant.

  if (!grantFromUrl) {
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
        grant={grantFromUrl}
      />
    </div>
  )
}

function JoinClient({
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

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: apiBaseUrl,
        credentials: "omit",
      }),
    [apiBaseUrl]
  )

  const join = useCallback(
    () =>
      api.sessions.join(bookingId, {
        grant,
      }),
    [api, bookingId, grant]
  )

  return (
    <JoinSession
      join={join}
      labels={labels}
      backHref={backHref}
      showNotesSlot={false}
    />
  )
}
