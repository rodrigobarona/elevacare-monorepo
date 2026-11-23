import { cache } from "react"
import type { Metadata } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import { BuildingsIcon } from "@eleva/icons"
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
import { FILING_STATUS_TONES } from "../filing-status-tones"

export const dynamic = "force-dynamic"

const PATH = "/clinics"

// One read for the page and its title: each read of a queue is recorded.
const loadQueue = cache(async (page: number) => {
  const api = await getAuthedApiClient()
  return api.admin.clinics.list({ page })
})

export async function generateMetadata({
  searchParams,
}: {
  searchParams: QueueSearchParams
}): Promise<Metadata> {
  const page = await requestedQueuePage(searchParams, PATH)
  const [queue, t] = await Promise.all([
    loadQueue(page),
    getTranslations("clinics"),
  ])
  return { title: await queueTitle(t("title"), queue) }
}

export default async function ClinicsPage({
  searchParams,
}: {
  searchParams: QueueSearchParams
}) {
  const page = await requestedQueuePage(searchParams, PATH)
  const [queue, t, format] = await Promise.all([
    loadQueue(page),
    getTranslations("clinics"),
    getFormatter(),
  ])
  followQueuePage(PATH, page, queue)
  const { items } = queue

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t("title")} description={t("description")} />
      {items.length === 0 ? (
        <EmptyState
          icon={<BuildingsIcon />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : (
        <DataTableShell footer={<QueuePager path={PATH} queue={queue} />}>
          <Table aria-label={t("title")} aria-describedby={QUEUE_RANGE_ID}>
            <TableHeader>
              <TableHead isRowHeader>{t("columns.clinic")}</TableHead>
              <TableHead>{t("columns.legalName")}</TableHead>
              <TableHead>{t("columns.state")}</TableHead>
              <TableHead>{t("columns.waiting")}</TableHead>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.verificationId}
                  id={item.verificationId}
                  href={`/clinics/${item.verificationId}`}
                  className="group cursor-pointer"
                >
                  <TableCell>
                    <span className="font-medium text-primary underline-offset-4 group-hover:underline">
                      {item.clinicName}
                    </span>
                    {item.verified ? (
                      <p className="text-sm text-muted-foreground">
                        {t("alreadyVerified")}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{item.legalName}</TableCell>
                  <TableCell>
                    <StatusPill tone={FILING_STATUS_TONES[item.status]}>
                      {t(`states.${item.status}`)}
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
