import { getFormatter, getTranslations } from "next-intl/server"
import { professionalBodyById } from "@eleva/config/professional-bodies"
import { ShieldIcon } from "@eleva/icons"
import { DataTableShell } from "@eleva/ui/components/data-table-shell"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"
import { StatusPill } from "@eleva/ui/components/status-pill"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eleva/ui/components/table"
import { getAuthedApiClient } from "@/lib/server-api"
import { REVIEW_STATE_TONES } from "./review-state-tones"

export const dynamic = "force-dynamic"

export default async function PartnersPage() {
  const api = await getAuthedApiClient()
  const [{ items }, t, format] = await Promise.all([
    api.admin.partners.list(),
    getTranslations("partners"),
    getFormatter(),
  ])

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t("title")} description={t("description")} />
      {items.length === 0 ? (
        <EmptyState
          icon={<ShieldIcon />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : (
        <DataTableShell>
          <Table aria-label={t("title")}>
            <TableHeader>
              <TableHead isRowHeader>{t("columns.expert")}</TableHead>
              <TableHead>{t("columns.body")}</TableHead>
              <TableHead>{t("columns.state")}</TableHead>
              <TableHead>{t("columns.waiting")}</TableHead>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.expertProfileId}
                  id={item.expertProfileId}
                  href={`/partners/${item.expertProfileId}`}
                  className="group cursor-pointer"
                >
                  <TableCell>
                    <span className="font-medium text-primary underline-offset-4 group-hover:underline">
                      {item.displayName}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      @{item.username}
                    </p>
                  </TableCell>
                  <TableCell>
                    {item.professionalBody
                      ? (professionalBodyById(item.professionalBody)?.name ??
                        item.professionalBody)
                      : t("unknownBody")}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={REVIEW_STATE_TONES[item.reviewState]}>
                      {t(`states.${item.reviewState}`)}
                    </StatusPill>
                  </TableCell>
                  <TableCell>
                    {format.dateTime(new Date(item.waitingSince), {
                      dateStyle: "medium",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableShell>
      )}
    </div>
  )
}
