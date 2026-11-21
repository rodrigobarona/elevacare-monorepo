import { describe, expect, it, vi } from "vitest"

vi.mock("@eleva/db", () => ({
  auth: { user: {}, organization: {}, member: {} },
  main: { clinicProfiles: {} },
  CLINIC_DECISION_EVENT_TYPES: [
    "clinic.verified",
    "clinic.needs_changes",
    "clinic.rejected",
  ],
  withPlatformAdminContext: vi.fn(),
}))
vi.mock("./send-notification", () => ({ sendNotification: vi.fn() }))

import {
  isClinicDecisionKind,
  sendClinicDecisionNotification,
} from "./send-clinic-decision"

const ORG_ID = "00000000-0000-4000-8000-000000000001"
const VERIFICATION_ID = "00000000-0000-4000-8000-000000000002"
const OWNER = "00000000-0000-4000-8000-000000000003"
const ADMIN = "00000000-0000-4000-8000-000000000004"

const clinic = {
  orgSlug: "clinica-lumen",
  clinicName: "Clínica Lumen",
  managers: [
    { userId: OWNER, name: "Ana Mota", locale: "pt-PT" },
    { userId: ADMIN, name: "Luis Vega", locale: "es" },
  ],
}

function event(
  type: string,
  payload: { reason?: string | null; verified?: boolean } = {}
) {
  return {
    id: "evt-1",
    type,
    orgId: ORG_ID,
    payload: {
      verificationId: VERIFICATION_ID,
      reason: payload.reason ?? null,
      verified: payload.verified ?? false,
    },
  }
}

describe("sendClinicDecisionNotification", () => {
  it("tells the owner and each admin in their own language, with the reason and the Verification page", async () => {
    const send = vi.fn().mockResolvedValue({})
    await sendClinicDecisionNotification(
      event("clinic.needs_changes", {
        reason: "A denominação no registo é Clínica Lumen, Unipessoal Lda.",
      }),
      { send, loadClinic: vi.fn(async () => clinic) }
    )

    expect(send).toHaveBeenCalledTimes(2)
    const [owner, admin] = send.mock.calls.map((call) => call[0])
    expect(owner.kind).toBe("clinic.needs_changes")
    expect(owner.orgId).toBe(ORG_ID)
    expect(owner.recipient).toEqual({ userId: OWNER })
    expect(owner.idempotencyKey).toBe(`clinic:evt-1:${OWNER}`)
    expect(owner.ctx.subject).toBe(
      "Precisamos de uma alteração nos dados legais da sua clínica"
    )
    expect(owner.ctx.html).toContain(
      "A denominação no registo é Clínica Lumen, Unipessoal Lda."
    )
    expect(owner.ctx.html).toContain("Clínica Lumen")
    expect(owner.ctx.html).toContain("Ana")
    expect(owner.ctx.href).toMatch(/\/team\/clinica-lumen\/verification$/)
    expect(owner.ctx.html).toContain("/team/clinica-lumen/verification")

    expect(admin.recipient).toEqual({ userId: ADMIN })
    expect(admin.idempotencyKey).toBe(`clinic:evt-1:${ADMIN}`)
    expect(admin.ctx.subject).toBe(
      "Necesitamos un cambio en los datos legales de tu clínica"
    )
  })

  it("keeps what staff found off the subject and the inbox line", async () => {
    const send = vi.fn().mockResolvedValue({})
    await sendClinicDecisionNotification(
      event("clinic.rejected", { reason: "Sentinel reason" }),
      {
        send,
        loadClinic: vi.fn(async () => ({
          ...clinic,
          managers: [{ userId: OWNER, name: "Ana Mota", locale: null }],
        })),
      }
    )
    const { ctx } = send.mock.calls[0]![0]
    expect(ctx.subject).toBe("We could not verify your clinic")
    expect(ctx.title).toBe("We could not verify your clinic")
    expect(ctx.subject).not.toContain("Sentinel")
    expect(ctx.body).not.toContain("Sentinel")
    expect(ctx.html).toContain("Sentinel reason")
  })

  it("never tells a verified clinic that it could not be verified", async () => {
    const send = vi.fn().mockResolvedValue({})
    const one = {
      ...clinic,
      managers: [{ userId: OWNER, name: "Ana Mota", locale: "en" }],
    }
    await sendClinicDecisionNotification(
      event("clinic.rejected", {
        reason: "Not in the register.",
        verified: true,
      }),
      { send, loadClinic: vi.fn(async () => one) }
    )
    await sendClinicDecisionNotification(
      event("clinic.needs_changes", { reason: "Typo.", verified: true }),
      { send, loadClinic: vi.fn(async () => one) }
    )
    const [rejected, changes] = send.mock.calls.map((call) => call[0].ctx)
    expect(rejected.subject).toBe(
      "We could not confirm your clinic's new details"
    )
    expect(rejected.body).toContain("Your clinic stays verified")
    expect(rejected.html).not.toContain("could not verify your clinic")
    expect(changes.body).toContain("Your clinic stays verified")
  })

  it("says the clinic is verified, with no reason row", async () => {
    const send = vi.fn().mockResolvedValue({})
    await sendClinicDecisionNotification(
      event("clinic.verified", { verified: true }),
      {
        send,
        loadClinic: vi.fn(async () => ({
          ...clinic,
          managers: [{ userId: OWNER, name: "Ana Mota", locale: "en" }],
        })),
      }
    )
    const { ctx } = send.mock.calls[0]![0]
    expect(ctx.subject).toBe("Your clinic is verified")
    expect(ctx.html).not.toContain("What we found")
  })

  it("fails when the clinic is gone or the payload is not a decision", async () => {
    await expect(
      sendClinicDecisionNotification(event("clinic.verified"), {
        send: vi.fn(),
        loadClinic: vi.fn(async () => null),
      })
    ).rejects.toThrow("clinic not found")
    await expect(
      sendClinicDecisionNotification(
        { ...event("clinic.verified"), payload: { reason: null } },
        { send: vi.fn(), loadClinic: vi.fn(async () => clinic) }
      )
    ).rejects.toThrow("payload is invalid")
  })

  it("only claims clinic decision kinds", () => {
    expect(isClinicDecisionKind("clinic.verified")).toBe(true)
    expect(isClinicDecisionKind("partner.approved")).toBe(false)
  })
})
