/**
 * Paging a list by page number. One module for the API (which rows), the
 * page (which links) and the copy ("Showing 26 to 50 of 112").
 */

/** Rows a staff queue shows on one page. */
export const STAFF_QUEUE_PAGE_SIZE = 25

/** The highest page a request may name. A larger number is not a page. */
export const MAX_PAGE = 10_000

/**
 * What a page number looks like in an address: digits, no sign, no zero in
 * front, from 1 to `MAX_PAGE`. The limit is written into the pattern so a
 * schema made from it (the OpenAPI parameter) refuses what the API refuses.
 */
export const PAGE_PARAM_PATTERN = /^(?:[1-9]\d{0,3}|10000)$/

export interface PageWindow {
  /** The page shown, from 1: the one asked for, pulled back inside the list. */
  page: number
  /** How many pages there are; 1 for an empty list. */
  pages: number
  total: number
  /** Rows to skip to reach this page. */
  offset: number
  /** The first and last row shown, counted from 1; both 0 for an empty list. */
  from: number
  to: number
  hasPrevious: boolean
  hasNext: boolean
}

/**
 * Where a page sits in a list of `total` rows. A page past the end (the
 * list shrank, or the address was typed) is the last page, never an empty
 * one.
 */
export function pageWindow(input: {
  total: number
  page: number
  pageSize: number
}): PageWindow {
  const total = Math.max(0, Math.trunc(input.total))
  const pageSize = Math.max(1, Math.trunc(input.pageSize))
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const asked = Number.isFinite(input.page) ? Math.trunc(input.page) : 1
  const page = Math.min(Math.max(1, asked), pages)
  const offset = (page - 1) * pageSize
  return {
    page,
    pages,
    total,
    offset,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + pageSize, total),
    hasPrevious: page > 1,
    hasNext: page < pages,
  }
}

/** How many times a page read follows a list that keeps getting shorter. */
const PAGE_READ_ROUNDS = 3

/**
 * Reads one page of a list that other people change while it is read.
 *
 * `rowsFrom(offset)` is one statement that returns the rows from `offset`
 * and, on each of them, the size of the whole list (`count(*) over ()`).
 * The rows and the count then describe the same moment: a count read first
 * and rows read after can disagree, and a list that got one row shorter in
 * between would come back as an empty last page.
 *
 * No row at the page asked for means the list is empty or the page is past
 * its end. The top of the list says which, and the read moves to the last
 * page. A list that keeps getting shorter ends at its top.
 */
export async function readPage<Row>(input: {
  page: number
  pageSize: number
  rowsFrom: (offset: number) => Promise<Array<Row & { total: number }>>
}): Promise<{ rows: Row[]; window: PageWindow }> {
  const pageSize = Math.max(1, Math.trunc(input.pageSize))
  const asked = Number.isFinite(input.page) ? Math.trunc(input.page) : 1
  const settle = (found: Array<Row & { total: number }>, page: number) => ({
    rows: found.map(({ total: _total, ...row }) => row as unknown as Row),
    window: pageWindow({ total: found[0]?.total ?? 0, page, pageSize }),
  })
  let page = Math.max(1, asked)
  let top: Array<Row & { total: number }> = []
  for (let round = 0; round < PAGE_READ_ROUNDS; round++) {
    const found = await input.rowsFrom((page - 1) * pageSize)
    if (found.length > 0 || page === 1) return settle(found, page)
    top = await input.rowsFrom(0)
    const last = pageWindow({ total: top[0]?.total ?? 0, page, pageSize }).page
    if (last === 1) return settle(top, 1)
    page = last
  }
  return settle(top, 1)
}

/**
 * The page a `?page=` value names: a whole number from 1 to `MAX_PAGE`.
 * Null for anything else ("0", "-2", "abc", "1.5", "2 ", a repeated
 * parameter), so the caller can send the reader to a clean address.
 */
export function parsePageParam(
  value: string | string[] | undefined
): number | null {
  if (typeof value !== "string" || !PAGE_PARAM_PATTERN.test(value)) return null
  const page = Number(value)
  return page <= MAX_PAGE ? page : null
}
