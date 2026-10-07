import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getExpertBookingById } from "@eleva/db"
import { PageHeader } from "@eleva/ui/components/page-header"
import { LinkButton } from "@eleva/ui/components/button"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { JoinClient } from "./join-client"

export const dynamic = "force-dynamic"

export default async function ExpertJoinPage({
  params,
}: {
  params: Promise<{ orgSlug: string; bookingId: string }>
}) {
  const { orgSlug, bookingId } = await params
  const { profile } = await loadExpertWorkspace(orgSlug, "events:manage")
  const [t, booking] = await Promise.all([
    getTranslations("sessions"),
    getExpertBookingById(profile.orgId, profile.id, bookingId),
  ])
  if (!booking) notFound()

  const backHref = `/${orgSlug}/calendar`
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
