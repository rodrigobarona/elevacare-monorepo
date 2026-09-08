import { beforeEach, describe, expect, it, vi } from "vitest"

const { limit, withAudit } = vi.hoisted(() => {
  const limit = vi.fn()
  const withAudit = vi.fn(
    async (
      _opts: unknown,
      fn: (
        tx: { execute: ReturnType<typeof vi.fn> },
        ctx: { emit: ReturnType<typeof vi.fn> }
      ) => Promise<void>
    ) => {
      await fn({ execute: vi.fn() }, { emit: vi.fn() })
    }
  )
  return { limit, withAudit }
})

vi.mock("@eleva/audit", () => ({ withAudit }))
vi.mock("@eleva/db", () => ({
  db: () => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({ limit }),
        }),
      }),
    }),
  }),
  auth: {
    organization: { id: "id", type: "type" },
    member: { organizationId: "organization_id", userId: "user_id" },
  },
}))

import { provisionPersonalSpace } from "./provision-personal-space"

describe("provisionPersonalSpace", () => {
  beforeEach(() => {
    limit.mockReset()
    withAudit.mockClear()
  })

  it("is a no-op when a personal Space already exists", async () => {
    limit.mockResolvedValue([{ id: "org-1" }])
    await provisionPersonalSpace({ id: "user-1", name: "Ada Lovelace" })
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("creates a first-name Space exactly once", async () => {
    limit.mockResolvedValue([])
    await provisionPersonalSpace({ id: "user-1", name: "Ada Lovelace" })
    expect(withAudit).toHaveBeenCalledTimes(1)
    const [, fn] = withAudit.mock.calls[0] as [
      { orgId: string; actorUserId: string },
      (
        tx: { execute: ReturnType<typeof vi.fn> },
        ctx: { emit: ReturnType<typeof vi.fn> }
      ) => Promise<void>,
    ]
    const emit = vi.fn()
    const execute = vi.fn()
    await fn({ execute }, { emit })
    expect(execute).toHaveBeenCalledTimes(2)
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "organization",
        action: "created",
        payload: { type: "personal", name: "Ada's Space" },
      })
    )
  })
})
