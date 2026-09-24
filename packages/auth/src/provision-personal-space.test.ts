import { beforeEach, describe, expect, it, vi } from "vitest"

const { limit, orderByLimit, withAudit } = vi.hoisted(() => {
  const limit = vi.fn()
  const orderByLimit = vi.fn()
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
  return { limit, orderByLimit, withAudit }
})

vi.mock("@eleva/audit", () => ({ withAudit }))
vi.mock("@eleva/db", () => ({
  db: () => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit,
            orderBy: () => ({ limit: orderByLimit }),
          }),
        }),
      }),
    }),
  }),
  auth: {
    organization: { id: "id", type: "type" },
    member: {
      organizationId: "organization_id",
      userId: "user_id",
      createdAt: "created_at",
    },
  },
}))

import {
  findDefaultOrganizationId,
  provisionPersonalSpace,
} from "./provision-personal-space"

describe("provisionPersonalSpace", () => {
  beforeEach(() => {
    limit.mockReset()
    orderByLimit.mockReset()
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

describe("findDefaultOrganizationId", () => {
  beforeEach(() => {
    limit.mockReset()
    orderByLimit.mockReset()
  })

  it("returns the personal Space when present", async () => {
    limit.mockResolvedValue([{ id: "personal-1" }])
    await expect(findDefaultOrganizationId("user-1")).resolves.toBe(
      "personal-1"
    )
    expect(orderByLimit).not.toHaveBeenCalled()
  })

  it("falls back to the oldest membership when no personal Space", async () => {
    limit.mockResolvedValue([])
    orderByLimit.mockResolvedValue([{ id: "expert-1" }])
    await expect(findDefaultOrganizationId("user-1")).resolves.toBe("expert-1")
  })

  it("returns null when the user has no memberships", async () => {
    limit.mockResolvedValue([])
    orderByLimit.mockResolvedValue([])
    await expect(findDefaultOrganizationId("user-1")).resolves.toBeNull()
  })
})
