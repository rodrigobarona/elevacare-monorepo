import { beforeEach, describe, expect, it, vi } from "vitest"

const { state, disconnect } = vi.hoisted(() => ({
  state: {
    profile: null as null | Record<string, unknown>,
    deleted: [] as Array<Record<string, unknown>>,
    profileUpdate: null as null | Record<string, unknown>,
    emits: [] as Array<Record<string, unknown>>,
    lookups: [] as Array<{ userId: string; orgId: string }>,
  },
  disconnect: vi.fn(async () => undefined),
}))

vi.mock("./registry", () => ({
  getAdapter: () => ({ disconnect }),
}))
vi.mock("@eleva/db", () => ({
  main: {
    expertProfiles: {},
    expertIntegrations: {},
  },
  getExpertProfileForOrg: async (userId: string, orgId: string) => {
    state.lookups.push({ userId, orgId })
    return state.profile
  },
}))
vi.mock("@eleva/audit", () => ({
  withAudit: async (
    _opts: unknown,
    fn: (tx: unknown, ctx: unknown) => unknown
  ) =>
    fn(
      {
        delete: () => ({
          where: () => ({ returning: async () => state.deleted }),
        }),
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => ({
                for: async () => [
                  {
                    metadata: {
                      invoicingProvider: "toconline",
                      onboarding: { invoicing: true },
                    },
                  },
                ],
              }),
            }),
          }),
        }),
        update: () => ({
          set: (values: Record<string, unknown>) => {
            state.profileUpdate = values
            return { where: async () => undefined }
          },
        }),
      },
      {
        emit: async (e: Record<string, unknown>) => {
          state.emits.push(e)
        },
      }
    ),
}))

import { disconnectExpertInvoicing } from "./invoicing-connection"

describe("disconnectExpertInvoicing", () => {
  beforeEach(() => {
    state.profile = null
    state.deleted = []
    state.profileUpdate = null
    state.emits = []
    state.lookups = []
    disconnect.mockClear()
  })

  it("returns null without an expert profile in that org", async () => {
    await expect(
      disconnectExpertInvoicing({ userId: "u-1", orgId: "o-1" })
    ).resolves.toBe(null)
    expect(state.lookups).toEqual([{ userId: "u-1", orgId: "o-1" }])
  })

  it("is a no-op when no provider is set", async () => {
    state.profile = { id: "p-1", orgId: "o-1", invoicingProvider: null }
    await expect(
      disconnectExpertInvoicing({ userId: "u-1", orgId: "o-1" })
    ).resolves.toEqual({ disconnected: false, provider: null })
    expect(state.emits).toHaveLength(0)
  })

  it("deletes credentials, resets setup and audits the disconnect", async () => {
    state.profile = { id: "p-1", orgId: "o-1", invoicingProvider: "toconline" }
    state.deleted = [{ id: "int-1", slug: "toconline", vaultRef: "vault-1" }]

    await expect(
      disconnectExpertInvoicing({ userId: "u-1", orgId: "o-1" })
    ).resolves.toEqual({ disconnected: true, provider: "toconline" })

    expect(state.profileUpdate).toMatchObject({
      invoicingProvider: null,
      invoicingSetupStatus: "not_started",
      metadata: { onboarding: { invoicing: true } },
    })
    expect(state.profileUpdate?.metadata).not.toHaveProperty(
      "invoicingProvider"
    )
    expect(state.emits[0]).toMatchObject({
      entity: "expert_integration_credential",
      action: "disconnected",
      entityId: "int-1",
      payload: { provider: "toconline", credentialsDeleted: 1 },
    })
    expect(disconnect).toHaveBeenCalledWith({ vaultRef: "vault-1" })
  })
})
