import type { AuditCtx } from "@eleva/audit"
import {
  STAFF_QUEUE_PAGE_SIZE,
  type PageWindow,
} from "@eleva/config/pagination"
import type { ApiAuthMode } from "./types"

/**
 * How a queue read was authenticated: a browser session (`cookie`: the
 * console, or anything else that carries that session), a token or a key.
 * `unknown` when the request did not say. It tells a key from a session;
 * it cannot tell a person from a script that holds their session.
 */
export type StaffQueueReadVia = ApiAuthMode | "unknown"

/** The staff member reading a queue, and the staff workspace they act in. */
export interface StaffQueueReader {
  actorUserId: string
  orgId: string
  via: StaffQueueReadVia
}

/** One page of a staff queue, and where it sits in the whole queue. */
export interface StaffQueuePage<Row> {
  items: Row[]
  total: number
  /** The page returned: the one asked for, or the last one if it was past it. */
  page: number
  pages: number
  pageSize: number
}

/**
 * Records that one page of a queue was served, and returns it. The record
 * says who read, which page, how many rows and how the read was made: a
 * person paging at the console and a key walking every page must not look
 * the same afterwards. Never whose rows they were.
 */
export async function servedQueuePage<Row>(
  ctx: AuditCtx,
  entity: "clinic_verification" | "partner_application",
  viewer: StaffQueueReader,
  rows: Row[],
  window: PageWindow
): Promise<StaffQueuePage<Row>> {
  await ctx.emit({
    entity,
    action: "listed",
    entityId: null,
    payload: {
      page: window.page,
      pages: window.pages,
      shown: rows.length,
      total: window.total,
      via: viewer.via,
    },
  })
  return {
    items: rows,
    total: window.total,
    page: window.page,
    pages: window.pages,
    pageSize: STAFF_QUEUE_PAGE_SIZE,
  }
}
