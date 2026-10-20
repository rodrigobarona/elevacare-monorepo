import { beforeEach, describe, expect, it, vi } from "vitest"
import { withPlatformAdminContext } from "@eleva/db"
import {
  listMemberRecordAccessChoices,
  MemberRecordAccessForbiddenError,
  setMemberRecordAccessOptout,
} from "./member-record-access"

vi.mock("@eleva/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@eleva/db")>()
  return {
    ...actual,
    withPlatformAdminContext: vi.fn(),
  }
})

vi.mock("@eleva/audit", () => ({
  withPlatformAudit: vi.fn(
    async (
      _opts: unknown,
      fn: (tx: unknown, ctx: { emit: (e: unknown) => Promise<void> }) => unknown
    ) => {
      const emit = vi.fn(async () => {})
      return fn({}, { emit })
    }
  ),
}))

const withPlatformAdminContextMock = vi.mocked(withPlatformAdminContext)

describe("member record access opt-out", () => {
  beforeEach(() => {
    withPlatformAdminContextMock.mockReset()
  })

  it("returns no choices when the member has no team bookings", async () => {
    withPlatformAdminContextMock.mockImplementation(async (fn) =>
      fn({
        selectDistinct: () => ({
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: async () => [],
              }),
            }),
          }),
        }),
      } as never)
    )

    await expect(listMemberRecordAccessChoices("user-1")).resolves.toEqual([])
  })

  it("rejects opt-out for an org without an eligible booking", async () => {
    withPlatformAdminContextMock.mockImplementation(async (fn) =>
      fn({
        selectDistinct: () => ({
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: async () => [],
              }),
            }),
          }),
        }),
      } as never)
    )

    await expect(
      setMemberRecordAccessOptout({
        userId: "user-1",
        orgId: "00000000-0000-4000-8000-000000000001",
        optedOut: true,
      })
    ).rejects.toBeInstanceOf(MemberRecordAccessForbiddenError)
  })
})
