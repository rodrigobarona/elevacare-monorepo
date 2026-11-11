import { describe, expect, it } from "vitest"
import {
  nextParticipantState,
  webhookAuditAction,
  webhookEventWriteGate,
} from "./daily-webhook"

describe("webhookAuditAction", () => {
  it("maps lifecycle events only", () => {
    expect(webhookAuditAction("meeting.started")).toBe("started")
    expect(webhookAuditAction("meeting.ended")).toBe("ended")
  })

  it("does not treat participant history as session.joined", () => {
    expect(webhookAuditAction("participant.joined")).toBeNull()
    expect(webhookAuditAction("participant.left")).toBeNull()
    expect(webhookAuditAction("error")).toBeNull()
  })
})

describe("webhookEventWriteGate", () => {
  it("lets an unprocessed event row proceed into the session write", () => {
    expect(webhookEventWriteGate(null)).toBe("proceed")
    expect(webhookEventWriteGate(undefined)).toBe("proceed")
  })

  it("treats a stamped processed_at as a replay, even on retry", () => {
    expect(webhookEventWriteGate(new Date("2026-10-08T12:00:00.000Z"))).toBe(
      "duplicate"
    )
  })
})

describe("nextParticipantState", () => {
  const T = (clock: string) => new Date(`2026-11-16T${clock}:00.000Z`)
  const booked = { start: T("10:00"), end: T("11:00") }
  const EXPERT = "33333333-3333-4333-8333-333333333333"
  const MEMBER = "44444444-4444-4444-8444-444444444444"
  const BOOKING = "11111111-1111-4111-8111-111111111111"

  function joined(
    userId: string,
    at: string,
    history: Parameters<typeof nextParticipantState>[0]["participants"],
    status: "no_show" | "scheduled" = "no_show",
    memberUserId: string | null = MEMBER
  ) {
    return nextParticipantState({
      status,
      participants: history,
      payload: { user_id: userId },
      incoming: T(at),
      type: "participant.joined",
      expertUserId: EXPERT,
      memberUserId,
      booked,
    })
  }

  it("keeps a no-show when the other person comes to an empty room", () => {
    const next = joined(EXPERT, "11:20", [
      {
        role: "member",
        userId: MEMBER,
        joinedAt: T("10:00").toISOString(),
        leftAt: T("10:40").toISOString(),
      },
    ])
    expect(next.status).toBe("no_show")
    expect(next.corrected).toBe(false)
    expect(next.participants).toHaveLength(2)
  })

  it("does not correct a no-show the moment the other person arrives", () => {
    // The member is still inside; the expert has only just joined.
    const next = joined(EXPERT, "11:20", [
      { role: "member", userId: MEMBER, joinedAt: T("11:00").toISOString() },
    ])
    expect(next.status).toBe("no_show")
    expect(next.corrected).toBe(false)
  })

  it("corrects a no-show once the two have been in the room together", () => {
    const next = nextParticipantState({
      status: "no_show",
      participants: [
        { role: "member", userId: MEMBER, joinedAt: T("11:00").toISOString() },
        { role: "expert", userId: EXPERT, joinedAt: T("11:20").toISOString() },
      ],
      payload: { user_id: EXPERT },
      incoming: T("11:28"),
      type: "participant.left",
      expertUserId: EXPERT,
      memberUserId: MEMBER,
      booked,
    })
    expect(next.status).toBe("ended")
    expect(next.corrected).toBe(true)
  })

  it("never closes or reopens a session by itself", () => {
    const next = joined(EXPERT, "10:00", [], "scheduled")
    expect(next.status).toBe("scheduled")
    expect(next.corrected).toBe(false)
  })

  it("counts a member who booked without an account as the member", () => {
    const next = joined(`guest:${BOOKING}`, "10:00", [], "scheduled", null)
    expect(next.participants).toEqual([
      expect.objectContaining({ role: "member" }),
    ])
  })
})
