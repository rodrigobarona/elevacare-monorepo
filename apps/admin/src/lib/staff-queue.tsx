import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { pageWindow, parsePageParam } from "@eleva/config/pagination"
import { FocusHeadingOnChange } from "@eleva/ui/components/focus-heading-on-change"
import { Pager } from "@eleva/ui/components/pager"

export type QueueSearchParams = Promise<{ page?: string | string[] }>

/** What the API says about the page it returned. */
export interface QueuePosition {
  total: number
  page: number
  pages: number
  pageSize: number
}

/** The id of the range line, for the table's `aria-describedby`. */
export const QUEUE_RANGE_ID = "queue-range"

function queueHref(path: string, page: number): string {
  return page > 1 ? `${path}?page=${page}` : path
}

/**
 * The page a queue address asks for. A value that is not a page (`0`,
 * `abc`, a negative number) and a needless `?page=1` both go to the clean
 * address: one address for one page.
 */
export async function requestedQueuePage(
  searchParams: QueueSearchParams,
  path: string
): Promise<number> {
  const raw = (await searchParams).page
  if (raw === undefined) return 1
  const page = parsePageParam(raw)
  if (page === null || page === 1) redirect(path)
  return page
}

/**
 * The API pulls a page past the end back to the last one (the queue shrank
 * after decisions, or the address was typed). The address follows, so the
 * reader never sees an empty table with a pager.
 */
export function followQueuePage(
  path: string,
  asked: number,
  queue: QueuePosition
): void {
  if (queue.page !== asked) redirect(queueHref(path, queue.page))
}

/** "Clinic verifications · Page 2 of 5", or the title alone on one page. */
export async function queueTitle(
  title: string,
  queue: QueuePosition
): Promise<string> {
  if (queue.pages <= 1) return title
  const t = await getTranslations("queue")
  return t("titleWithPage", { title, page: queue.page, pages: queue.pages })
}

/** The footer of a queue: where the reader is, and the pages on either side. */
export async function QueuePager({
  path,
  queue,
}: {
  path: string
  queue: QueuePosition
}) {
  const t = await getTranslations("queue")
  const { from, to, total, hasPrevious, hasNext } = pageWindow(queue)
  return (
    <>
      <Pager
        rangeId={QUEUE_RANGE_ID}
        range={
          from === to
            ? t("rangeSingle", { to, total })
            : t("range", { from, to, total })
        }
        end={queue.pages > 1 && !hasNext ? t("end") : undefined}
        links={
          queue.pages > 1
            ? {
                previous: hasPrevious ? queueHref(path, queue.page - 1) : null,
                next: hasNext ? queueHref(path, queue.page + 1) : null,
              }
            : undefined
        }
        labels={{
          landmark: t("pages"),
          previous: t("previous"),
          next: t("next"),
          previousPage: t("previousPage"),
          nextPage: t("nextPage"),
        }}
      />
      <FocusHeadingOnChange value={queue.page} />
    </>
  )
}
