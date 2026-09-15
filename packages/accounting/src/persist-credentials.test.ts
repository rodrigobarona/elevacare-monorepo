import { beforeEach, describe, expect, it, vi } from "vitest"

const { emit, set, where, withAudit, adapterStatus } = vi.hoisted(() => {
  const emitFn = vi.fn()
  const setFn = vi.fn()
  const whereFn = vi.fn().mockResolvedValue(undefined)
  const withAuditFn = vi.fn(
    async (
      _opts: unknown,
      fn: (
        tx: {
          update: () => { set: (vals: unknown) => { where: typeof whereFn } }
        },
        ctx: { emit: typeof emitFn }
      ) => Promise<void>
    ) =>
      fn(
        {
          update: () => ({
            set: (vals: unknown) => {
              setFn(vals)
              return { where: whereFn }
            },
          }),
        },
        { emit: emitFn }
      )
  )
  return {
    emit: emitFn,
    set: setFn,
    where: whereFn,
    withAudit: withAuditFn,
    adapterStatus: vi.fn(),
  }
})

vi.mock("@eleva/audit", () => ({
  withAudit,
}))

vi.mock("@eleva/db", () => ({
  main: {
    expertIntegrations: { id: "id" },
  },
}))

vi.mock("./registry", () => ({
  getAdapter: () => ({
    status: (...args: unknown[]) => adapterStatus(...args),
  }),
}))

import {
  persistExpertIntegrationCredentials,
  probeExpertInvoicingStatus,
  toPublicAdapterStatus,
} from "./persist-credentials"

describe("toPublicAdapterStatus", () => {
  it("strips rotated vault ciphertext", () => {
    expect(
      toPublicAdapterStatus({
        status: "healthy",
        rotatedCredentials: {
          vaultRef: "vault-ref-rotated",
          expiresAt: new Date("2026-09-15T10:00:00.000Z"),
        },
      })
    ).toEqual({ status: "healthy" })
  })
})

describe("persistExpertIntegrationCredentials", () => {
  beforeEach(() => {
    emit.mockReset()
    set.mockReset()
    where.mockClear()
    withAudit.mockClear()
  })

  it("writes rotated vaultRef, expiresAt, and lastRefreshAt", async () => {
    const expiresAt = new Date("2026-09-15T11:00:00.000Z")
    await persistExpertIntegrationCredentials({
      orgId: "00000000-0000-4000-8000-000000000002",
      integrationId: "00000000-0000-4000-8000-000000000099",
      vaultRef: "vault-ref-rotated",
      expiresAt,
      metadata: { orgId: "00000000-0000-4000-8000-000000000002" },
      rotated: true,
    })

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        vaultRef: "vault-ref-rotated",
        expiresAt,
        lastRefreshAt: expect.any(Date),
        metadata: { orgId: "00000000-0000-4000-8000-000000000002" },
      })
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "expert_integration_credential",
        action: "updated",
        payload: expect.objectContaining({ rotated: true }),
      })
    )
  })

  it("leaves stored metadata untouched when no metadata patch is provided", async () => {
    await persistExpertIntegrationCredentials({
      orgId: "00000000-0000-4000-8000-000000000002",
      integrationId: "00000000-0000-4000-8000-000000000099",
      vaultRef: "vault-ref-rotated",
      expiresAt: new Date("2026-09-15T11:00:00.000Z"),
      rotated: true,
    })

    const patch = set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch).not.toHaveProperty("metadata")
    expect(patch).toMatchObject({
      vaultRef: "vault-ref-rotated",
      lastRefreshAt: expect.any(Date),
    })
  })
})

describe("probeExpertInvoicingStatus", () => {
  beforeEach(() => {
    emit.mockReset()
    set.mockReset()
    where.mockClear()
    withAudit.mockClear()
    adapterStatus.mockReset()
  })

  it("persists rotated credentials from status and returns a public payload", async () => {
    const expiresAt = new Date("2026-09-15T11:00:00.000Z")
    adapterStatus.mockResolvedValue({
      status: "healthy",
      rotatedCredentials: {
        vaultRef: "vault-ref-rotated",
        expiresAt,
      },
    })

    const result = await probeExpertInvoicingStatus({
      orgId: "00000000-0000-4000-8000-000000000002",
      provider: "toconline",
      integrationId: "00000000-0000-4000-8000-000000000099",
      vaultRef: "vault-ref",
      metadata: {
        userId: "00000000-0000-4000-8000-000000000003",
      },
    })

    expect(result).toEqual({ status: "healthy" })
    expect(result).not.toHaveProperty("rotatedCredentials")
    const patch = set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch).toMatchObject({
      vaultRef: "vault-ref-rotated",
      expiresAt,
      lastRefreshAt: expect.any(Date),
    })
    expect(patch).not.toHaveProperty("metadata")
  })

  it("does not write when credentials did not rotate", async () => {
    adapterStatus.mockResolvedValue({ status: "healthy" })

    await probeExpertInvoicingStatus({
      orgId: "00000000-0000-4000-8000-000000000002",
      provider: "toconline",
      integrationId: "00000000-0000-4000-8000-000000000099",
      vaultRef: "vault-ref",
      metadata: {
        userId: "00000000-0000-4000-8000-000000000003",
      },
    })

    expect(withAudit).not.toHaveBeenCalled()
  })
})
