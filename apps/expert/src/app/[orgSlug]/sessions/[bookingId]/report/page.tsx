import { notFound } from "next/navigation"
import { getFormatter, getTranslations } from "next-intl/server"
import { getExpertBookingById } from "@eleva/db"
import { getFlag } from "@eleva/flags"
import { PageHeader } from "@eleva/ui/components/page-header"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { getApiBaseUrl } from "@/lib/server-api"
import { expertWorkspacePath } from "@/lib/workspace-paths"
import { ReportEditor } from "./report-editor"

export const dynamic = "force-dynamic"

export default async function ExpertSessionReportPage({
  params,
}: {
  params: Promise<{ orgSlug: string; bookingId: string }>
}) {
  const { orgSlug, bookingId } = await params
  const { session, profile } = await loadExpertWorkspace(
    orgSlug,
    "events:manage"
  )
  const [t, format, booking, aiReportsBeta] = await Promise.all([
    getTranslations("sessions.report"),
    getFormatter(),
    getExpertBookingById(profile.orgId, profile.id, bookingId),
    getFlag("ff.ai_reports_beta"),
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
        templatesHref={expertWorkspacePath(session, "templates")}
        aiReportsBeta={aiReportsBeta}
      />
    </div>
  )
}
