import { describe, expect, it, vi } from "vitest"
import {
  MarketingConsentRequiredError,
  TriggerAutomationError,
  triggerAutomation,
} from "./trigger-automation"
import {
  MarketingCallerPayloadSchema,
  MarketingPayloadSchema,
} from "./marketing-payload"

const USER_ID = "00000000-0000-4000-8000-000000000001"
const ORG_ID = "00000000-0000-4000-8000-000000000002"

describe("MarketingCallerPayloadSchema", () => {
  it("accepts closed plan tiers only", () => {
    expect(
      MarketingCallerPayloadSchema.parse({
        plan_tier: "expert_community",
        generic_booking_count: 2,
      })
    ).toEqual({
      plan_tier: "expert_community",
      generic_booking_count: 2,
    })
  })

  it("rejects free-form plan_tier and unknown keys", () => {
    expect(() =>
      MarketingCallerPayloadSchema.parse({ plan_tier: "vip-health" })
    ).toThrow()
    expect(() =>
      MarketingCallerPayloadSchema.parse({
        plan_tier: "expert_community",
        diagnosis: "migraine",
      })
    ).toThrow()
  })
})

describe("MarketingPayloadSchema", () => {
  it("requires derived first_name and locale", () => {
    expect(
      MarketingPayloadSchema.parse({
        first_name: "Ana",
        locale: "pt",
        plan_tier: "member_free",
      })
    ).toMatchObject({ first_name: "Ana", locale: "pt" })
  })
})

describe("triggerAutomation", () => {
  it("requires marketing consent via sync upsert", async () => {
    await expect(
      triggerAutomation(
        {
          event: "welcome.expert",
          userId: USER_ID,
          orgId: ORG_ID,
          marketingPayload: { plan_tier: "expert_community" },
        },
        {
          sync: async () => ({
            action: "deleted",
            email: "ana@example.com",
            contactId: null,
            orgId: ORG_ID,
          }),
          sendEvent: async () => undefined,
          auditTrigger: async () => undefined,
        }
      )
    ).rejects.toBeInstanceOf(MarketingConsentRequiredError)
  })

  it("rejects caller-supplied first_name (must come from Neon user)", async () => {
    const sendEvent = vi.fn()
    await expect(
      triggerAutomation(
        {
          event: "welcome.patient",
          userId: USER_ID,
          marketingPayload: {
            first_name: "Diagnosis leakage",
            locale: "en",
          },
        },
        {
          sync: async () => ({
            action: "upserted",
            email: "ana@example.com",
            contactId: "c1",
            firstName: "Ana",
            locale: "en",
            orgId: ORG_ID,
          }),
          sendEvent,
          auditTrigger: async () => undefined,
        }
      )
    ).rejects.toBeInstanceOf(TriggerAutomationError)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it("derives first_name/locale from sync and sends the event", async () => {
    const sendEvent = vi.fn(async () => undefined)
    const auditTrigger = vi.fn(async () => undefined)
    const result = await triggerAutomation(
      {
        event: "pack.expiring",
        userId: USER_ID,
        marketingPayload: {
          plan_tier: "expert_community",
          generic_booking_count: 0,
        },
      },
      {
        sync: async () => ({
          action: "upserted",
          email: "ana@example.com",
          contactId: "c1",
          firstName: "Ana",
          locale: "es",
          orgId: ORG_ID,
        }),
        sendEvent,
        auditTrigger,
      }
    )
    expect(result.event).toBe("pack.expiring")
    expect(sendEvent).toHaveBeenCalledWith({
      event: "pack.expiring",
      email: "ana@example.com",
      payload: {
        first_name: "Ana",
        locale: "es",
        plan_tier: "expert_community",
        generic_booking_count: 0,
      },
    })
    expect(auditTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: ORG_ID })
    )
  })
})
