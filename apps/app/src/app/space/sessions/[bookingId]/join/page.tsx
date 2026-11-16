import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { LinkButton } from "@eleva/ui/components/button"
import { findMemberBooking } from "@/lib/find-member-booking"
import {
  getApiBaseUrl,
  getAuthedApiClient,
  requireMemberSpace,
} from "@/lib/member-api"
import { JoinClient } from "./join-client"
import { SPACE_BASE } from "@eleva/config/routing"

export const dynamic = "force-dynamic"

export default async function MemberJoinPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  await requireMemberSpace()
  const [t, api] = await Promise.all([
    getTranslations("sessions"),
    getAuthedApiClient(),
  ])
  const booking = await findMemberBooking(api, bookingId)
  if (!booking) notFound()

  const backHref = `${SPACE_BASE}/sessions/${bookingId}`
  const apiBaseUrl = getApiBaseUrl()

  if (booking.sessionMode !== "online") {
    return (
      <div className="space-y-6">
        <PageHeader title={t("join")} description={t("joinNotOnline")} />
        <LinkButton href={backHref}>{t("detailTitle")}</LinkButton>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("join")} />
      <JoinClient
        bookingId={bookingId}
        apiBaseUrl={apiBaseUrl}
        backHref={backHref}
      />
    </div>
  )
}
