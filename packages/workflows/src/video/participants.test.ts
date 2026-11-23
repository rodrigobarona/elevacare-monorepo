import { describe, expect, it } from "vitest"
import { buildSessionRoomBody, DailyHttpError } from "@eleva/video"
import {
  dailyFailureKind,
  isRetryableDailyFailure,
  isSelfDelegate,
  runRevokedParticipantDailyCleanup,
  SessionParticipantError,
  shouldRepairRoomCapacity,
} from "./participants"
import { classifyJoinCaller } from "./join"

describe("SessionParticipantError", () => {
  it("carries a closed error code", () => {
    const err = new SessionParticipantError("NOT_ASSIGNED_EXPERT")
    expect(err.code).toBe("NOT_ASSIGNED_EXPERT")
    expect(err.name).toBe("SessionParticipantError")
  })
})

describe("isSelfDelegate", () => {
  it("rejects the assigned expert and the member", () => {
    expect(isSelfDelegate("expert-1", "expert-1", "member-1")).toBe(true)
    expect(isSelfDelegate("member-1", "expert-1", "member-1")).toBe(true)
    expect(isSelfDelegate("delegate-1", "expert-1", "member-1")).toBe(false)
  })
})

describe("shouldRepairRoomCapacity", () => {
  it("waits while a revoked participant is still pending eject", () => {
    expect(shouldRepairRoomCapacity(1)).toBe(false)
    expect(shouldRepairRoomCapacity(0)).toBe(true)
  })
})

describe("dailyFailureKind", () => {
  it("is away when the service could not answer: tried every minute or two", () => {
    expect(dailyFailureKind(new DailyHttpError(503, "busy"))).toBe("away")
    expect(dailyFailureKind(new DailyHttpError(429, "slow"))).toBe("away")
    expect(dailyFailureKind(new DOMException("t", "TimeoutError"))).toBe("away")
    expect(dailyFailureKind(new TypeError("fetch failed"))).toBe("away")
  })

  it("is refused only when the service says we may not: hourly, and reported", () => {
    expect(dailyFailureKind(new DailyHttpError(401, "key"))).toBe("refused")
    expect(dailyFailureKind(new DailyHttpError(403, "no"))).toBe("refused")
  })

  it("is unsure for the rest: it may pass, so it is not left for an hour at once", () => {
    expect(dailyFailureKind(new DailyHttpError(400, "bad"))).toBe("unsure")
    expect(dailyFailureKind(new DailyHttpError(409, "busy"))).toBe("unsure")
    expect(dailyFailureKind(new DailyHttpError(423, "locked"))).toBe("unsure")
    expect(dailyFailureKind(new TypeError("terminated"))).toBe("unsure")
    expect(dailyFailureKind(new Error("something else"))).toBe("unsure")
  })
})

describe("isRetryableDailyFailure", () => {
  it("retries Daily 5xx and rethrows other failures", () => {
    expect(isRetryableDailyFailure(new DailyHttpError(503, "busy"))).toBe(true)
    expect(isRetryableDailyFailure(new DailyHttpError(404, "gone"))).toBe(false)
    expect(isRetryableDailyFailure(new Error("db"))).toBe(false)
    // "Not now" is as good a reason to try again as "could not".
    expect(isRetryableDailyFailure(new DailyHttpError(429, "slow"))).toBe(true)
    expect(isRetryableDailyFailure(new DailyHttpError(408, "late"))).toBe(true)
    expect(isRetryableDailyFailure(new DailyHttpError(403, "no"))).toBe(false)
    // No answer at all: the ten-second limit of the client, or no network.
    expect(
      isRetryableDailyFailure(new DOMException("timed out", "TimeoutError"))
    ).toBe(true)
    expect(
      isRetryableDailyFailure(new DOMException("aborted", "AbortError"))
    ).toBe(true)
    expect(isRetryableDailyFailure(new TypeError("fetch failed"))).toBe(true)
    // A mistake of our own is not the service being away.
    expect(isRetryableDailyFailure(new TypeError("x is not a function"))).toBe(
      false
    )
    expect(isRetryableDailyFailure("timeout")).toBe(false)
  })
})

describe("delegate join contract", () => {
  it("lets an active delegate join and rejects after revoke", () => {
    expect(
      classifyJoinCaller({
        userId: "delegate-1",
        isActiveExpert: false,
        memberUserId: "member-1",
        hasActiveDelegate: true,
      })
    ).toEqual({ role: "delegate" })
    expect(
      classifyJoinCaller({
        userId: "delegate-1",
        isActiveExpert: false,
        memberUserId: "member-1",
        hasActiveDelegate: false,
      })
    ).toEqual({ error: "NOT_A_PARTICIPANT" })
  })

  it("fits a third participant in room capacity", () => {
    const body = buildSessionRoomBody({
      bookingId: "11111111-1111-4111-8111-111111111111",
      startAt: new Date("2026-10-07T10:00:00.000Z"),
      endAt: new Date("2026-10-07T11:00:00.000Z"),
      extraParticipants: 1,
    })
    expect(body.properties.max_participants).toBe(3)
  })
})

describe("runRevokedParticipantDailyCleanup", () => {
  const bookingId = "11111111-1111-4111-8111-111111111111"
  const input = {
    bookingId,
    dailyRoomName: `eleva-${bookingId}`,
    startsAt: new Date("2026-10-08T10:00:00.000Z"),
    endsAt: new Date("2026-10-08T11:00:00.000Z"),
    language: "pt",
    userId: "delegate-1",
    extraParticipants: 0,
    otherPendingEjects: 0,
  }

  it("ejects the revoked user, persists ejectedAt, then shrinks capacity", async () => {
    const order: string[] = []
    const result = await runRevokedParticipantDailyCleanup(
      input,
      {
        daily: {
          updateSessionRoom: async () => {
            order.push("capacity")
          },
          ejectParticipants: async () => {
            order.push("eject")
          },
        },
      },
      async () => {
        order.push("persist")
      }
    )
    expect(order).toEqual(["eject", "persist", "capacity"])
    expect(result).toEqual({ status: "ok" })
  })

  it("does not shrink capacity when eject is retryable", async () => {
    const order: string[] = []
    const result = await runRevokedParticipantDailyCleanup(input, {
      daily: {
        updateSessionRoom: async () => {
          order.push("capacity")
        },
        ejectParticipants: async () => {
          order.push("eject")
          throw new DailyHttpError(503, "busy")
        },
      },
    })
    expect(order).toEqual(["eject"])
    expect(result).toEqual({ status: "ejectionPending" })
  })

  it("records capacity pending after a successful eject", async () => {
    const order: string[] = []
    const result = await runRevokedParticipantDailyCleanup(input, {
      daily: {
        updateSessionRoom: async () => {
          order.push("capacity")
          throw new DailyHttpError(503, "busy")
        },
        ejectParticipants: async () => {
          order.push("eject")
        },
      },
    })
    expect(order).toEqual(["eject", "capacity"])
    expect(result).toEqual({ status: "ok", capacityPending: true })
  })

  it("returns ejectionPending when persist fails after a successful eject", async () => {
    const order: string[] = []
    const result = await runRevokedParticipantDailyCleanup(
      input,
      {
        daily: {
          updateSessionRoom: async () => {
            order.push("capacity")
          },
          ejectParticipants: async () => {
            order.push("eject")
          },
        },
      },
      async () => {
        order.push("persist")
        throw new Error("audit")
      }
    )
    expect(order).toEqual(["eject", "persist"])
    expect(result).toEqual({ status: "ejectionPending" })
  })

  it("does not shrink capacity while another eject is still pending", async () => {
    const order: string[] = []
    const result = await runRevokedParticipantDailyCleanup(
      { ...input, otherPendingEjects: 1 },
      {
        daily: {
          updateSessionRoom: async () => {
            order.push("capacity")
          },
          ejectParticipants: async () => {
            order.push("eject")
          },
        },
      }
    )
    expect(order).toEqual(["eject"])
    expect(result).toEqual({ status: "ok", capacityPending: true })
  })
})
