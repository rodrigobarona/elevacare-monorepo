import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { LinkButton } from "@eleva/ui/components/button"
import { findMemberBooking } from "@/lib/find-member-booking"
import { getAuthedApiClient, requireMemberOrg } from "@/lib/member-api"
import { JoinClient } from "./join-client"

export const dynamic = "force-dynamic"

export default async function MemberJoinPage({
  params,
}: {
  params: Promise<{ orgSlug: string; bookingId: string }>
}) {
  const { orgSlug, bookingId } = await params
  await requireMemberOrg(orgSlug)
  const [t, api] = await Promise.all([
    getTranslations("sessions"),
    getAuthedApiClient(),
  ])
  const booking = await findMemberBooking(api, bookingId)
  if (!booking) notFound()

  const backHref = `/${orgSlug}/sessions/${bookingId}`
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"

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
