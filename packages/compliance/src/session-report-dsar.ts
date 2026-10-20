import { withPhiScope } from "@eleva/observability"
import { listMemberReports } from "@eleva/records"
import { toCsv } from "./dsar-csv"
import { hasDsarCollector, registerDsarCollector } from "./dsar-collectors"

export const SESSION_REPORT_DSAR_COLLECTOR_ID = "session_reports" as const

/** Reports experts published to the member. Unpublished records stay out. */
export function ensureSessionReportDsarCollector(): void {
  if (hasDsarCollector(SESSION_REPORT_DSAR_COLLECTOR_ID)) return
  registerDsarCollector({
    id: SESSION_REPORT_DSAR_COLLECTOR_ID,
    collect: (userId) =>
      withPhiScope(async () => {
        const reports = await listMemberReports({ memberUserId: userId })
        const json = reports.map((report) => ({
          id: report.id,
          bookingId: report.bookingId,
          sessionStartsAt: report.sessionStartsAt,
          expert: report.expertDisplayName,
          title: report.title,
          body: report.body,
          publishedAt: report.publishedAt,
        }))
        return { filename: "session_reports", json, csv: toCsv(json) }
      }),
  })
}
