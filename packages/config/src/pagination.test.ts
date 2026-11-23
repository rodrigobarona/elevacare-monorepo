import { describe, expect, it } from "vitest"
import {
  MAX_PAGE,
  pageWindow,
  readPage,
  parsePageParam,
  STAFF_QUEUE_PAGE_SIZE,
} from "./pagination"

describe("pageWindow", () => {
  const of = (total: number, page: number) =>
    pageWindow({ total, page, pageSize: STAFF_QUEUE_PAGE_SIZE })

  it("says which rows a page shows", () => {
    expect(of(112, 1)).toMatchObject({ from: 1, to: 25, offset: 0, pages: 5 })
    expect(of(112, 2)).toMatchObject({ from: 26, to: 50, offset: 25 })
    expect(of(112, 5)).toMatchObject({ from: 101, to: 112, offset: 100 })
  })

  it("knows the ends", () => {
    expect(of(112, 1)).toMatchObject({ hasPrevious: false, hasNext: true })
    expect(of(112, 3)).toMatchObject({ hasPrevious: true, hasNext: true })
    expect(of(112, 5)).toMatchObject({ hasPrevious: true, hasNext: false })
    expect(of(12, 1)).toMatchObject({
      pages: 1,
      from: 1,
      to: 12,
      hasPrevious: false,
      hasNext: false,
    })
    // A full last page has no next.
    expect(of(50, 2)).toMatchObject({ to: 50, hasNext: false })
  })

  it("pulls a page past the end back to the last one, never an empty page", () => {
    expect(of(112, 9)).toMatchObject({ page: 5, from: 101, to: 112 })
    expect(of(112, 0)).toMatchObject({ page: 1 })
    expect(of(112, -3)).toMatchObject({ page: 1 })
    expect(of(112, Number.NaN)).toMatchObject({ page: 1 })
  })

  it("is one empty page for an empty list", () => {
    expect(of(0, 4)).toEqual({
      page: 1,
      pages: 1,
      total: 0,
      offset: 0,
      from: 0,
      to: 0,
      hasPrevious: false,
      hasNext: false,
    })
  })
})

describe("parsePageParam", () => {
  it("reads a whole number from 1", () => {
    expect(parsePageParam("1")).toBe(1)
    expect(parsePageParam("27")).toBe(27)
    expect(parsePageParam(String(MAX_PAGE))).toBe(MAX_PAGE)
  })

  it.each([
    undefined,
    "",
    "0",
    "-2",
    "abc",
    "1.5",
    "2 ",
    " 2",
    "02",
    "1e3",
    "10001",
    "99999",
    "2; drop",
    ["2", "3"],
  ])("answers null for %j", (value) => {
    expect(parsePageParam(value)).toBeNull()
  })
})

describe("readPage", () => {
  /** A list of `size` rows that `shrink` can shorten between two reads. */
  function list(size: number) {
    const state = { size, reads: [] as number[] }
    const rowsFrom = async (offset: number) => {
      state.reads.push(offset)
      return Array.from(
        { length: Math.max(0, Math.min(25, state.size - offset)) },
        (_, index) => ({ n: offset + index + 1, total: state.size })
      )
    }
    return { state, rowsFrom }
  }

  it("reads a page and its count in one statement", async () => {
    const { state, rowsFrom } = list(60)
    const { rows, window } = await readPage({ page: 2, pageSize: 25, rowsFrom })
    expect(rows[0]).toEqual({ n: 26 })
    expect(rows).toHaveLength(25)
    expect(window).toMatchObject({ page: 2, pages: 3, total: 60, from: 26 })
    expect(state.reads).toEqual([25])
  })

  it("answers an empty first page for an empty list", async () => {
    const { state, rowsFrom } = list(0)
    const { rows, window } = await readPage({ page: 1, pageSize: 25, rowsFrom })
    expect(rows).toEqual([])
    expect(window).toMatchObject({ page: 1, pages: 1, total: 0 })
    expect(state.reads).toEqual([0])
  })

  it("goes to the last page when the page asked for is past the end", async () => {
    const { state, rowsFrom } = list(60)
    const { rows, window } = await readPage({ page: 9, pageSize: 25, rowsFrom })
    expect(rows.map((row) => row.n)).toEqual([
      51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
    ])
    expect(window).toMatchObject({ page: 3, pages: 3, total: 60 })
    expect(state.reads).toEqual([200, 0, 50])
  })

  it("never answers an empty last page when the list got one row shorter", async () => {
    // 26 rows when the address was built; a filing was decided since.
    const { rowsFrom } = list(25)
    const { rows, window } = await readPage({ page: 2, pageSize: 25, rowsFrom })
    expect(rows).toHaveLength(25)
    expect(window).toMatchObject({
      page: 1,
      pages: 1,
      total: 25,
      hasPrevious: false,
    })
  })

  it("ends at the top of a list that keeps getting shorter", async () => {
    const { state, rowsFrom } = list(200)
    const shrinking = async (offset: number) => {
      const found = await rowsFrom(offset)
      // Every look at the top is followed by the last page emptying.
      if (offset === 0) state.size -= 25
      return found
    }
    const { rows, window } = await readPage({
      page: 20,
      pageSize: 25,
      rowsFrom: shrinking,
    })
    expect(rows[0]).toEqual({ n: 1 })
    expect(window.page).toBe(1)
    expect(state.reads.length).toBeLessThanOrEqual(6)
  })
})
