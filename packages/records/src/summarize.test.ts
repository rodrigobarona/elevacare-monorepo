import { beforeEach, describe, expect, it, vi } from "vitest"

import { SessionRecordError } from "./errors"

const listSessionRecords = vi.hoisted(() => vi.fn())
const draftSessionReport = vi.hoisted(() => vi.fn())

vi.mock("./session-records", () => ({ listSessionRecords }))
vi.mock("./draft-session-report", () => ({ draftSessionReport }))

import { summarizeSessionRecords } from "./summarize"

const input = {
  bookingId: "00000000-0000-4000-8000-000000000001",
  actorUserId: "00000000-0000-4000-8000-000000000002",
}

describe("summarizeSessionRecords", () => {
  beforeEach(() => {
    listSessionRecords.mockReset()
    draftSessionReport.mockReset()
  })

  it("rejects when the booking has no notes to summarize", async () => {
    listSessionRecords.mockResolvedValue([{ id: "intake-1", kind: "intake" }])

    await expect(summarizeSessionRecords(input)).rejects.toMatchObject({
      name: "SessionRecordError",
      code: "FORBIDDEN",
    } satisfies Partial<SessionRecordError>)
    expect(draftSessionReport).not.toHaveBeenCalled()
  })

  it("drafts a report from the note records only", async () => {
    listSessionRecords.mockResolvedValue([
      { id: "note-1", kind: "note" },
      { id: "intake-1", kind: "intake" },
    ])
    draftSessionReport.mockResolvedValue({ id: "report-1" })

    await expect(summarizeSessionRecords(input)).resolves.toEqual({
      id: "report-1",
    })
    expect(draftSessionReport).toHaveBeenCalledWith({
      ...input,
      noteRecordIds: ["note-1"],
    })
  })
})
