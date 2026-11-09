import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("./sentry", () => ({ captureException: vi.fn(async () => undefined) }))

import { describeError, logError } from "./error-log"
import { captureException } from "./sentry"

const PII = "insert into member values ('Ana Silva', 'ana@example.com')"

describe("describeError", () => {
  it("keeps names and codes along the cause chain, never messages", () => {
    const pg = Object.assign(new Error(PII), { code: "42P10" })
    const wrapped = new Error(`Failed query: ${PII}`, { cause: pg })
    wrapped.name = "DrizzleQueryError"
    const summary = describeError(wrapped)
    expect(summary).toBe("DrizzleQueryError <- Error:42P10")
    expect(summary).not.toContain("ana@example.com")
  })

  it("describes values that are not errors by their type", () => {
    expect(describeError("boom")).toBe("string")
    expect(describeError(undefined)).toBe("")
  })

  it("stops at a fixed cause depth", () => {
    let err: Error = new Error("root")
    for (let i = 0; i < 10; i++) err = new Error("wrap", { cause: err })
    expect(describeError(err).split(" <- ")).toHaveLength(4)
  })
})

describe("logError", () => {
  afterEach(() => vi.restoreAllMocks())

  it("logs the summary only and hands the full error to Sentry", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const err = new Error(PII)
    logError("[me/bookings/cancel] unexpected error", err)
    expect(spy).toHaveBeenCalledWith(
      "[me/bookings/cancel] unexpected error",
      "Error"
    )
    expect(JSON.stringify(spy.mock.calls)).not.toContain("ana@example.com")
    expect(captureException).toHaveBeenCalledWith(err, {
      event: "[me/bookings/cancel] unexpected error",
    })
  })
})
