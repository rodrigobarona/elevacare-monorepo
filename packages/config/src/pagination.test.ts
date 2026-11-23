import { describe, expect, it } from "vitest"
import {
  MAX_PAGE,
  pageWindow,
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
