import { describe, expect, it, vi } from "vitest"

vi.mock("@eleva/db", () => ({
  auth: { user: {}, organization: {} },
  main: { expertProfiles: {} },
  PARTNER_DECISION_EVENT_TYPES: [
    "partner.approved",
    "partner.needs_changes",
    "partner.rejected",
  ],
  withPlatformAdminContext: vi.fn(),
}))
vi.mock("./send-notification", () => ({ sendNotification: vi.fn() }))

import {
  isPartnerDecisionKind,
  sendPartnerDecisionNotification,
} from "./send-partner-decision"

const ORG_ID = "00000000-0000-4000-8000-000000000001"
const APPLICATION_ID = "00000000-0000-4000-8000-000000000002"
const PROFILE_ID = "00000000-0000-4000-8000-000000000003"

const expert = {
  orgId: ORG_ID,
  orgSlug: "fisiomota",
  userId: "00000000-0000-4000-8000-000000000004",
  displayName: "Ana Mota",
  locale: "pt-PT",
}

function event(type: string, reason: string | null = null) {
  return {
    id: "evt-1",
    type,
    orgId: ORG_ID,
    payload: {
      applicationId: APPLICATION_ID,
      expertProfileId: PROFILE_ID,
      reason,
    },
  }
}

describe("sendPartnerDecisionNotification", () => {
  it("emails the reason and a link to the licence page in the expert's locale", async () => {
    const send = vi.fn().mockResolvedValue({})
    await sendPartnerDecisionNotification(
      event("partner.needs_changes", "O número não coincide com o registo."),
      { send, loadExpert: vi.fn(async () => expert) }
    )

    expect(send).toHaveBeenCalledTimes(1)
    const input = send.mock.calls[0]![0]
    expect(input.kind).toBe("partner.needs_changes")
    expect(input.orgId).toBe(ORG_ID)
    expect(input.recipient).toEqual({ userId: expert.userId })
    expect(input.idempotencyKey).toBe("partner:evt-1")
    expect(input.ctx.subject).toBe(
      "Precisamos de uma alteração nos dados da sua cédula"
    )
    expect(input.ctx.html).toContain("O número não coincide com o registo.")
    expect(input.ctx.html).toContain("/fisiomota/licence")
    expect(input.ctx.html).toContain("Ana")
  })

  it("keeps staff reasons off the subject line", async () => {
    const send = vi.fn().mockResolvedValue({})
    await sendPartnerDecisionNotification(
      event("partner.rejected", "Sentinel reason"),
      { send, loadExpert: vi.fn(async () => ({ ...expert, locale: null })) }
    )
    const { ctx } = send.mock.calls[0]![0]
    expect(ctx.subject).toBe("We could not verify your licence")
    expect(ctx.subject).not.toContain("Sentinel")
    expect(ctx.body).not.toContain("Sentinel")
  })

  it("refuses an expert from another org", async () => {
    await expect(
      sendPartnerDecisionNotification(event("partner.approved"), {
        send: vi.fn(),
        loadExpert: vi.fn(async () => ({ ...expert, orgId: "other" })),
      })
    ).rejects.toThrow("expert not found")
  })

  it("only claims partner decision kinds", () => {
    expect(isPartnerDecisionKind("partner.approved")).toBe(true)
    expect(isPartnerDecisionKind("payout.paid")).toBe(false)
  })
})
