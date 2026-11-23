/**
 * Paging a list by page number. One module for the API (which rows), the
 * page (which links) and the copy ("Showing 26 to 50 of 112").
 */

/** Rows a staff queue shows on one page. */
export const STAFF_QUEUE_PAGE_SIZE = 25

/** The highest page a request may name. A larger number is not a page. */
export const MAX_PAGE = 10_000

/** What a page number looks like in an address: digits, no sign, no zero in front. */
export const PAGE_PARAM_PATTERN = /^[1-9]\d{0,4}$/

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
