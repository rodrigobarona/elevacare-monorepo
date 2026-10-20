import { notFound } from "next/navigation"
import { getFormatter, getTranslations } from "next-intl/server"
import { LinkButton } from "@eleva/ui/components/button"
import { PageHeader } from "@eleva/ui/components/page-header"
import { getAuthedApiClient, requireMemberOrg } from "@/lib/member-api"

export const dynamic = "force-dynamic"

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; reportId: string }>
}) {
  const { orgSlug, reportId } = await params
  await requireMemberOrg(orgSlug)
  const [t, format, api] = await Promise.all([
    getTranslations("reports"),
    getFormatter(),
    getAuthedApiClient(),
  ])
  const { reports } = await api.me.listReports()
  const report = reports.find((row) => row.id === reportId)
  if (!report) notFound()

  const sessionDate = format.dateTime(new Date(report.sessionStartsAt), {
    dateStyle: "long",
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("byExpert", { name: report.expertDisplayName })}
        description={t("sessionOn", { date: sessionDate })}
      />
      <article className="rounded-3xl border bg-card p-6 text-card-foreground shadow-1 sm:p-8">
        <p
          className="leading-relaxed whitespace-pre-wrap"
          data-testid="member-report-body"
        >
          {report.body}
        </p>
        {report.publishedAt ? (
          <p className="mt-6 text-xs text-muted-foreground">
            {t("publishedOn", {
              date: format.dateTime(new Date(report.publishedAt), {
                dateStyle: "medium",
              }),
            })}
          </p>
        ) : null}
      </article>
      <LinkButton variant="outline" href={`/${orgSlug}/reports`}>
        {t("back")}
      </LinkButton>
    </div>
  )
}
