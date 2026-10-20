import Link from "next/link"
import { getFormatter, getTranslations } from "next-intl/server"
import { BookOpenIcon, CaretRightIcon } from "@eleva/icons"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"
import { getAuthedApiClient, requireMemberOrg } from "@/lib/member-api"

export const dynamic = "force-dynamic"

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  await requireMemberOrg(orgSlug)
  const [t, format, api] = await Promise.all([
    getTranslations("reports"),
    getFormatter(),
    getAuthedApiClient(),
  ])
  const { reports } = await api.me.listReports()

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {reports.length === 0 ? (
        <EmptyState
          icon={<BookOpenIcon />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-1">
          {reports.map((report) => (
            <li key={report.id}>
              <Link
                href={`/${orgSlug}/reports/${report.id}`}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 sm:px-6"
                data-testid="member-report-row"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">
                    {t("byExpert", { name: report.expertDisplayName })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("sessionOn", {
                      date: format.dateTime(new Date(report.sessionStartsAt), {
                        dateStyle: "medium",
                      }),
                    })}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {t("read")}
                </span>
                <CaretRightIcon aria-hidden className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
