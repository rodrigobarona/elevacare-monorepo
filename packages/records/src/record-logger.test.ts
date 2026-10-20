import { Decrypted, registerPhi, withPhiScope } from "@eleva/observability"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  describeError,
  pickRecordLogFields,
  recordLogger,
} from "./record-logger"

const BODY = "Member reports lower back pain after the 10k run"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("recordLogger", () => {
  it("drops every key outside the allow-list", () => {
    const fields = {
      recordId: "rec_1",
      bookingId: "bk_1",
      tokenCount: 12,
      body: BODY,
      record: new Decrypted({ body: BODY }),
      title: "Session notes",
      nested: { body: BODY },
    }
    expect(pickRecordLogFields(fields)).toEqual({
      recordId: "rec_1",
      bookingId: "bk_1",
      tokenCount: 12,
    })
  })

  it("never prints record content, even through the event name", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    withPhiScope(() => {
      registerPhi(BODY)
      recordLogger.error(`upsert failed: ${BODY}`, {
        bookingId: "bk_1",
        status: BODY,
        ...({ body: BODY } as object),
      })
    })
    const printed = JSON.stringify(spy.mock.calls)
    expect(printed).not.toContain("back pain")
    expect(printed).toContain("bk_1")
  })

  it("describes errors by class and code, not message", () => {
    const err = Object.assign(new Error(`bad row ${BODY}`), { code: "23505" })
    expect(describeError(err)).toBe("Error:23505")
    expect(describeError(new TypeError(BODY))).toBe("TypeError")
    expect(describeError("boom")).toBe("string")
  })
})
