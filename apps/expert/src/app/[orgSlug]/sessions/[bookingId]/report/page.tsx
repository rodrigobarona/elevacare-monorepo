import { notFound } from "next/navigation"
import { getFormatter, getTranslations } from "next-intl/server"
import { getExpertBookingById } from "@eleva/db"
import { PageHeader } from "@eleva/ui/components/page-header"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { getApiBaseUrl } from "@/lib/server-api"
import { ReportEditor } from "./report-editor"

export const dynamic = "force-dynamic"

export default async function ExpertSessionReportPage({
  params,
}: {
  params: Promise<{ orgSlug: string; bookingId: string }>
}) {
  const { orgSlug, bookingId } = await params
  const { profile } = await loadExpertWorkspace(orgSlug, "events:manage")
  const [t, format, booking] = await Promise.all([
    getTranslations("sessions.report"),
    getFormatter(),
    getExpertBookingById(profile.orgId, profile.id, bookingId),
  ])
  if (!booking) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={format.dateTime(booking.startsAt, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        title={t("title")}
        description={t("subtitle")}
      />
      <ReportEditor
        bookingId={bookingId}
        apiBaseUrl={getApiBaseUrl()}
        backHref={`/${orgSlug}/calendar`}
      />
    </div>
  )
}
