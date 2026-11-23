import type { Metadata } from "next"
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
import {
  followQueuePage,
  QUEUE_RANGE_ID,
  QueuePager,
  queueTitle,
  requestedQueuePage,
  type QueueSearchParams,
} from "@/lib/staff-queue"
import { REVIEW_STATE_TONES } from "../review-state-tones"

export const dynamic = "force-dynamic"

const PATH = "/partners"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: QueueSearchParams
}): Promise<Metadata> {
  const t = await getTranslations("partners")
  return { title: await queueTitle(t("title"), searchParams) }
}

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: QueueSearchParams
}) {
  const page = await requestedQueuePage(searchParams, PATH)
  const api = await getAuthedApiClient()
  // Each read of a queue is recorded: this is the only one for this view.
  const [queue, t, format] = await Promise.all([
    api.admin.partners.list({ page }),
    getTranslations("partners"),
    getFormatter(),
  ])
  followQueuePage(PATH, page, queue)
  const { items } = queue

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
        <DataTableShell footer={<QueuePager path={PATH} queue={queue} />}>
          {/* Fixed columns: a page with longer names must not move them. */}
          <Table
            aria-label={t("title")}
            aria-describedby={QUEUE_RANGE_ID}
            className="min-w-160 table-fixed"
          >
            <TableHeader>
              <TableHead isRowHeader className="w-[30%]">
                {t("columns.expert")}
              </TableHead>
              <TableHead className="w-[34%]">{t("columns.body")}</TableHead>
              <TableHead className="w-[16%]">{t("columns.state")}</TableHead>
              <TableHead className="w-[20%]">{t("columns.waiting")}</TableHead>
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
