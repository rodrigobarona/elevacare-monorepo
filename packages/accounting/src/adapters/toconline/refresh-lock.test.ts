import { beforeEach, describe, expect, it, vi } from "vitest"

const { state, withAuditMock } = vi.hoisted(() => {
  const state = {
    rows: [] as Array<{ id: string; vaultRef: string | null }>,
    updates: [] as Array<Record<string, unknown>>,
    emits: [] as Array<Record<string, unknown>>,
  }
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({ for: async () => state.rows }),
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          state.updates.push(values)
        },
      }),
    }),
  }
  const withAuditMock = vi.fn(
    async (
      _opts: unknown,
      fn: (
        t: typeof tx,
        ctx: { emit: (e: Record<string, unknown>) => Promise<void> }
      ) => Promise<unknown>
    ) =>
      fn(tx, {
        emit: async (e) => {
          state.emits.push(e)
        },
      })
  )
  return { state, withAuditMock }
})

vi.mock("@eleva/audit", () => ({ withAudit: withAuditMock }))

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

describe("refreshToconlineSingleFlight", () => {
  beforeEach(() => {
    state.rows = []
    state.updates = []
    state.emits = []
    withAuditMock.mockClear()
  })

  it("refreshes and persists under the row lock when the stored ref is the stale one", async () => {
    state.rows = [{ id: "int-1", vaultRef: "stale" }]
    const refresh = vi.fn().mockResolvedValue(rotated("new"))
    const resolveStored = vi.fn()

    const result = await refreshToconlineSingleFlight({
      orgId: ORG,
      staleVaultRef: "stale",
      refreshToken: "rt-stale",
      resolveStored,
      refresh,
    })

    expect(refresh).toHaveBeenCalledWith("rt-stale")
    expect(resolveStored).not.toHaveBeenCalled()
    expect(result).toMatchObject({ vaultRef: "new", rotated: false })
    expect(state.updates[0]).toMatchObject({ vaultRef: "new" })
    expect(state.emits[0]).toMatchObject({
      entity: "expert_integration_credential",
      action: "updated",
      entityId: "int-1",
    })
  })

  it("reuses a token another instance already rotated without refreshing", async () => {
    state.rows = [{ id: "int-1", vaultRef: "already-rotated" }]
    const fresh = { ...rotated("already-rotated"), rotated: false }
    const refresh = vi.fn()

    const result = await refreshToconlineSingleFlight({
      orgId: ORG,
      staleVaultRef: "stale",
      refreshToken: "rt-stale",
      resolveStored: vi.fn().mockResolvedValue({ fresh }),
      refresh,
    })

    expect(result).toEqual(fresh)
    expect(refresh).not.toHaveBeenCalled()
    expect(state.updates).toHaveLength(0)
    expect(state.emits).toHaveLength(0)
  })

  it("refreshes with the stored refresh token when the stored ref also expired", async () => {
    state.rows = [{ id: "int-1", vaultRef: "newer-but-expired" }]
    const refresh = vi.fn().mockResolvedValue(rotated("newest"))

    await refreshToconlineSingleFlight({
      orgId: ORG,
      staleVaultRef: "stale",
      refreshToken: "rt-stale",
      resolveStored: vi.fn().mockResolvedValue({ refreshToken: "rt-newer" }),
      refresh,
    })

    expect(refresh).toHaveBeenCalledWith("rt-newer")
  })

  it("falls back to an unpersisted refresh when no integration row exists", async () => {
    const refresh = vi.fn().mockResolvedValue(rotated("new"))

    const result = await refreshToconlineSingleFlight({
      orgId: ORG,
      staleVaultRef: "stale",
      refreshToken: "rt-stale",
      resolveStored: vi.fn(),
      refresh,
    })

    expect(result.rotated).toBe(true)
    expect(state.updates).toHaveLength(0)
  })

  it("hands the rotated token back for caller persistence when the locked write fails", async () => {
    state.rows = [{ id: "int-1", vaultRef: "stale" }]
    withAuditMock.mockImplementationOnce(async (_opts, fn) => {
      await fn(
        {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => ({ for: async () => state.rows }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: async () => {
                throw new Error("connection reset")
              },
            }),
          }),
        } as never,
        { emit: async () => undefined }
      )
    })

    const result = await refreshToconlineSingleFlight({
      orgId: ORG,
      staleVaultRef: "stale",
      refreshToken: "rt-stale",
      resolveStored: vi.fn(),
      refresh: vi.fn().mockResolvedValue(rotated("new")),
    })

    expect(result).toMatchObject({ vaultRef: "new", rotated: true })
  })

  it("collapses concurrent refreshes for the same org into one", async () => {
    state.rows = [{ id: "int-1", vaultRef: "stale" }]
    let release: (v: ReturnType<typeof rotated>) => void = () => undefined
    const refresh = vi.fn(
      () =>
        new Promise<ReturnType<typeof rotated>>((resolve) => {
          release = resolve
        })
    )
    const input = {
      orgId: ORG,
      staleVaultRef: "stale",
      refreshToken: "rt-stale",
      resolveStored: vi.fn(),
      refresh,
    }

    const first = refreshToconlineSingleFlight(input)
    const second = refreshToconlineSingleFlight(input)
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    release(rotated("new"))

    const [a, b] = await Promise.all([first, second])
    expect(a).toBe(b)
    expect(withAuditMock).toHaveBeenCalledTimes(1)
  })
})
