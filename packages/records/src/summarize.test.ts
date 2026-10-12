import { describe, expect, it } from "vitest"
import { SessionRecordError } from "./errors"
import { summarizeSessionRecords } from "./summarize"

describe("summarizeSessionRecords", () => {
  it("fails closed until a zero-retention model is allow-listed", async () => {
    await expect(
      summarizeSessionRecords({
        bookingId: "00000000-0000-4000-8000-000000000001",
        actorUserId: "00000000-0000-4000-8000-000000000002",
      })
    ).rejects.toMatchObject({
      name: "SessionRecordError",
      code: "AI_MODEL_ZERO_RETENTION_REQUIRED",
    } satisfies Partial<SessionRecordError>)
  })
})
