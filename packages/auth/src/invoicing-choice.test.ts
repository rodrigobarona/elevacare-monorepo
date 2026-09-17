import { beforeEach, describe, expect, it, vi } from "vitest"

const { emit, set, selectLimit, withAudit } = vi.hoisted(() => {
  const emitFn = vi.fn()
  const setFn = vi.fn()
  const selectLimitFn = vi.fn()
  const withAuditFn = vi.fn(
    async (
      _opts: unknown,
      fn: (
        tx: {
          select: () => {
            from: () => {
              where: () => {
                limit: (n: number) => { for: (mode: string) => unknown }
              }
            }
          }
          update: () => { set: (vals: unknown) => { where: () => unknown } }
        },
        ctx: { emit: typeof emitFn }
      ) => Promise<void>
    ) =>
      fn(
        {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: (n: number) => ({
                  for: () => selectLimitFn(n),
                }),
              }),
            }),
          }),
          update: () => ({
            set: (vals: unknown) => {
              setFn(vals)
              return {
                where: () => ({
                  returning: async () => [{ id: "profile-1" }],
                }),
              }
            },
          }),
        },
        { emit: emitFn }
      )
  )
  return {
    emit: emitFn,
    set: setFn,
    selectLimit: selectLimitFn,
    withAudit: withAuditFn,
  }
})

vi.mock("@eleva/audit", () => ({
  withAudit,
}))

vi.mock("@eleva/db", () => ({
  main: {
    expertProfiles: {
      id: "id",
      metadata: "metadata",
    },
  },
}))

import {
  isExpertInvoicingChoiceComplete,
  saveExpertInvoicingChoice,
} from "./invoicing-choice"

describe("isExpertInvoicingChoiceComplete", () => {
  it("accepts only connected or manual acknowledgement", () => {
    expect(isExpertInvoicingChoiceComplete("connected")).toBe(true)
    expect(isExpertInvoicingChoiceComplete("manual_acknowledged")).toBe(true)
    expect(isExpertInvoicingChoiceComplete("not_started")).toBe(false)
    expect(isExpertInvoicingChoiceComplete("connecting")).toBe(false)
    expect(isExpertInvoicingChoiceComplete("expired")).toBe(false)
    expect(isExpertInvoicingChoiceComplete(null)).toBe(false)
  })
})

describe("saveExpertInvoicingChoice", () => {
  beforeEach(() => {
    emit.mockReset()
    set.mockReset()
    selectLimit.mockReset()
    withAudit.mockClear()
    selectLimit.mockResolvedValue([{ metadata: { locale: "pt" } }])
  })

  it("records manual acknowledgement without dropping existing metadata", async () => {
    await saveExpertInvoicingChoice({
      profileId: "00000000-0000-4000-8000-000000000001",
      orgId: "00000000-0000-4000-8000-000000000002",
      actorUserId: "00000000-0000-4000-8000-000000000003",
      provider: "manual",
    })

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        invoicingProvider: "manual",
        invoicingSetupStatus: "manual_acknowledged",
        metadata: expect.objectContaining({
          locale: "pt",
          invoicingProvider: "manual",
          completedSteps: ["invoicing"],
          manualInvoicingAcknowledgedAt: expect.any(String),
        }),
      })
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "expert_profile",
        action: "updated",
        payload: { field: "invoicing", provider: "manual", acknowledged: true },
      })
    )
  })

  it("refuses to emit when the profile row is gone", async () => {
    selectLimit.mockResolvedValue([])

    await expect(
      saveExpertInvoicingChoice({
        profileId: "00000000-0000-4000-8000-000000000001",
        orgId: "00000000-0000-4000-8000-000000000002",
        actorUserId: "00000000-0000-4000-8000-000000000003",
        provider: "toconline",
      })
    ).rejects.toThrow("expert profile not found")
    expect(set).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it("clears manual acknowledgement when switching to an automatic provider", async () => {
    selectLimit.mockResolvedValue([
      {
        metadata: {
          locale: "pt",
          invoicingProvider: "manual",
          completedSteps: ["invoicing", "identity"],
          manualInvoicingAcknowledgedAt: "2026-09-15T10:00:00.000Z",
        },
      },
    ])

    await saveExpertInvoicingChoice({
      profileId: "00000000-0000-4000-8000-000000000001",
      orgId: "00000000-0000-4000-8000-000000000002",
      actorUserId: "00000000-0000-4000-8000-000000000003",
      provider: "toconline",
    })

    const patch = set.mock.calls[0]?.[0] as {
      invoicingSetupStatus: string
      metadata: Record<string, unknown>
    }
    expect(patch.invoicingSetupStatus).toBe("connecting")
    expect(patch.metadata).toMatchObject({
      locale: "pt",
      invoicingProvider: "toconline",
      completedSteps: ["identity"],
    })
    expect(patch.metadata).not.toHaveProperty("manualInvoicingAcknowledgedAt")
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { field: "invoicing", provider: "toconline" },
      })
    )
  })
})
