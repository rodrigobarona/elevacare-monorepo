import { beforeEach, describe, expect, it, vi } from "vitest"

const { state, withAuditMock, withOrgContextMock } = vi.hoisted(() => {
  const state = {
    /** Successive reads of the integration row; the last one repeats. */
    reads: [] as Array<Array<{ id: string; vaultRef: string | null }>>,
    readCount: 0,
    casMatches: true,
    updates: [] as Array<Record<string, unknown>>,
    emits: [] as Array<Record<string, unknown>>,
    order: [] as string[],
  }
  const readTx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            state.order.push("read")
            const index = Math.min(state.readCount, state.reads.length - 1)
            state.readCount += 1
            return state.reads[index] ?? []
          },
        }),
      }),
    }),
  }
  const writeTx = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            state.order.push("write")
            state.updates.push(values)
            return state.casMatches ? [{ id: "int-1" }] : []
          },
        }),
      }),
    }),
  }
  const withOrgContextMock = vi.fn(
    async (_orgId: string, fn: (t: typeof readTx) => Promise<unknown>) =>
      fn(readTx)
  )
  const withAuditMock = vi.fn(
    async (
      _opts: unknown,
      fn: (
        t: typeof writeTx,
        ctx: { emit: (e: Record<string, unknown>) => Promise<void> }
      ) => Promise<unknown>
    ) =>
      fn(writeTx, {
        emit: async (e) => {
          state.emits.push(e)
        },
      })
  )
  return { state, withAuditMock, withOrgContextMock }
})

vi.mock("@eleva/audit", () => ({ withAudit: withAuditMock }))
vi.mock("@eleva/db", () => ({
  main: { expertIntegrations: {} },
  withOrgContext: withOrgContextMock,
}))

import { refreshToconlineSingleFlight } from "./refresh-lock"

const ORG = "00000000-0000-4000-8000-000000000002"

function rotated(vaultRef: string) {
  return {
    accessToken: `at-${vaultRef}`,
    vaultRef,
    expiresAt: new Date(Date.now() + 3600_000),
    rotated: true,
  }
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    orgId: ORG,
    staleVaultRef: "stale",
    refreshToken: "rt-stale",
    resolveStored: vi.fn(),
    refresh: vi.fn().mockResolvedValue(rotated("new")),
    ...overrides,
  }
}

describe("refreshToconlineSingleFlight", () => {
  beforeEach(() => {
    state.reads = []
    state.readCount = 0
    state.casMatches = true
    state.updates = []
    state.emits = []
    state.order = []
    withAuditMock.mockClear()
  })

  it("refreshes outside any transaction, then persists with compare-and-set", async () => {
    state.reads = [[{ id: "int-1", vaultRef: "stale" }]]
    const args = input({
      refresh: vi.fn(async () => {
        state.order.push("refresh")
        return rotated("new")
      }),
    })

    const result = await refreshToconlineSingleFlight(args)

    expect(args.refresh).toHaveBeenCalledWith("rt-stale")
    expect(state.order).toEqual(["read", "refresh", "write"])
    expect(result).toMatchObject({ vaultRef: "new", rotated: false })
    expect(state.updates[0]).toMatchObject({ vaultRef: "new" })
    expect(state.emits[0]).toMatchObject({
      entity: "expert_integration_credential",
      action: "updated",
      entityId: "int-1",
    })
  })

  it("reuses a token another instance already rotated without refreshing", async () => {
    state.reads = [[{ id: "int-1", vaultRef: "already-rotated" }]]
    const fresh = { ...rotated("already-rotated"), rotated: false }
    const args = input({ resolveStored: vi.fn().mockResolvedValue({ fresh }) })

    const result = await refreshToconlineSingleFlight(args)

    expect(result).toEqual(fresh)
    expect(args.refresh).not.toHaveBeenCalled()
    expect(withAuditMock).not.toHaveBeenCalled()
  })

  it("refreshes with the stored refresh token when the stored ref also expired", async () => {
    state.reads = [[{ id: "int-1", vaultRef: "newer-but-expired" }]]
    const args = input({
      resolveStored: vi.fn().mockResolvedValue({ refreshToken: "rt-newer" }),
    })

    await refreshToconlineSingleFlight(args)

    expect(args.refresh).toHaveBeenCalledWith("rt-newer")
  })

  it("falls back to an unpersisted refresh when no integration row exists", async () => {
    state.reads = [[]]
    const result = await refreshToconlineSingleFlight(input())

    expect(result.rotated).toBe(true)
    expect(withAuditMock).not.toHaveBeenCalled()
  })

  it("adopts the winner's token when the compare-and-set loses the race", async () => {
    state.reads = [
      [{ id: "int-1", vaultRef: "stale" }],
      [{ id: "int-1", vaultRef: "winner" }],
    ]
    state.casMatches = false
    const winner = { ...rotated("winner"), rotated: false }
    const args = input({
      resolveStored: vi.fn().mockResolvedValue({ fresh: winner }),
    })

    const result = await refreshToconlineSingleFlight(args)

    expect(result).toEqual(winner)
    expect(state.emits).toHaveLength(0)
  })

  it("adopts the winner's token when our refresh fails after a concurrent rotation", async () => {
    state.reads = [
      [{ id: "int-1", vaultRef: "stale" }],
      [{ id: "int-1", vaultRef: "winner" }],
    ]
    const winner = { ...rotated("winner"), rotated: false }
    const args = input({
      refresh: vi.fn().mockRejectedValue(new Error("invalid_grant")),
      resolveStored: vi.fn().mockResolvedValue({ fresh: winner }),
    })

    await expect(refreshToconlineSingleFlight(args)).resolves.toEqual(winner)
  })

  it("rethrows a refresh failure when nobody else rotated", async () => {
    state.reads = [[{ id: "int-1", vaultRef: "stale" }]]
    const args = input({
      refresh: vi.fn().mockRejectedValue(new Error("invalid_grant")),
    })

    await expect(refreshToconlineSingleFlight(args)).rejects.toThrow(
      "invalid_grant"
    )
  })

  it("hands the rotated token back for caller persistence when the write fails", async () => {
    state.reads = [[{ id: "int-1", vaultRef: "stale" }]]
    withAuditMock.mockRejectedValueOnce(new Error("connection reset"))

    const result = await refreshToconlineSingleFlight(input())

    expect(result).toMatchObject({ vaultRef: "new", rotated: true })
  })

  it("collapses concurrent refreshes for the same org into one", async () => {
    state.reads = [[{ id: "int-1", vaultRef: "stale" }]]
    let release: (v: ReturnType<typeof rotated>) => void = () => undefined
    const args = input({
      refresh: vi.fn(
        () =>
          new Promise<ReturnType<typeof rotated>>((resolve) => {
            release = resolve
          })
      ),
    })

    const first = refreshToconlineSingleFlight(args)
    const second = refreshToconlineSingleFlight(args)
    await vi.waitFor(() => expect(args.refresh).toHaveBeenCalledTimes(1))
    release(rotated("new"))

    const [a, b] = await Promise.all([first, second])
    expect(a).toBe(b)
    expect(withAuditMock).toHaveBeenCalledTimes(1)
  })
})
