import { describe, expect, it } from "vitest"
import {
  checkJoinGrant,
  joinGrantExpUnix,
  mintJoinGrant,
  sessionJoinPath,
  verifyJoinGrant,
} from "./join-grant"

const SECRET = "join-grant-test-secret"
const BOOKING_ID = "0d612e93-c4d0-4b9e-97b7-5df252ec9ba6"
const ENDS_AT = new Date("2026-10-08T12:00:00.000Z")
const NOW = new Date("2026-10-08T11:00:00.000Z")

describe("join grants", () => {
  it("mints a grant that verifies for that booking and role", async () => {
    const token = await mintJoinGrant({
      bookingId: BOOKING_ID,
      role: "member",
      endsAt: ENDS_AT,
      scheduleRevision: 0,
      now: NOW,
      secret: SECRET,
    })
    expect(token.includes(".")).toBe(true)
    expect(await verifyJoinGrant(token, { secret: SECRET, now: NOW })).toEqual({
      purpose: "session-join",
      bookingId: BOOKING_ID,
      role: "member",
      scheduleRevision: 0,
    })
  })

  it("expires at the join-window trail (endsAt + 30m)", () => {
    expect(joinGrantExpUnix(ENDS_AT)).toBe(
      Math.floor(ENDS_AT.getTime() / 1000) + 30 * 60
    )
  })

  it("rejects a tampered token, the wrong secret, and a Daily-shaped payload", async () => {
    const token = await mintJoinGrant({
      bookingId: BOOKING_ID,
      role: "expert",
      endsAt: ENDS_AT,
      scheduleRevision: 1,
      now: NOW,
      secret: SECRET,
    })
    expect(await verifyJoinGrant(`${token}x`, { secret: SECRET })).toBeNull()
    expect(await verifyJoinGrant(token, { secret: "other" })).toBeNull()
    expect(await verifyJoinGrant("not-a-jwt", { secret: SECRET })).toBeNull()
  })

  it("rejects a grant after the join window closes", async () => {
    const token = await mintJoinGrant({
      bookingId: BOOKING_ID,
      role: "member",
      endsAt: ENDS_AT,
      scheduleRevision: 0,
      now: NOW,
      secret: SECRET,
    })
    expect(
      await verifyJoinGrant(token, {
        secret: SECRET,
        now: new Date("2026-10-08T12:31:01.000Z"),
      })
    ).toBeNull()
  })

  it("tells a genuine grant past its end from a forged one", async () => {
    const token = await mintJoinGrant({
      bookingId: BOOKING_ID,
      role: "member",
      endsAt: ENDS_AT,
      scheduleRevision: 2,
      now: NOW,
      secret: SECRET,
    })
    const afterClose = new Date("2026-10-08T12:31:01.000Z")
    expect(
      await checkJoinGrant(token, { secret: SECRET, now: afterClose })
    ).toEqual({
      status: "expired",
      claims: {
        purpose: "session-join",
        bookingId: BOOKING_ID,
        role: "member",
        scheduleRevision: 2,
      },
    })
    expect(await checkJoinGrant(token, { secret: SECRET, now: NOW })).toEqual(
      expect.objectContaining({ status: "valid" })
    )
    // Expired and signed with another key, or tampered: no detail at all.
    expect(
      await checkJoinGrant(token, { secret: "other", now: afterClose })
    ).toEqual({ status: "invalid" })
    expect(
      await checkJoinGrant(`${token}x`, { secret: SECRET, now: afterClose })
    ).toEqual({ status: "invalid" })
    expect(await checkJoinGrant("not-a-jwt", { secret: SECRET })).toEqual({
      status: "invalid",
    })
  })

  it("builds the public join path without a Daily token query", () => {
    const path = sessionJoinPath(BOOKING_ID, "grant.jwt")
    expect(path).toBe(`/join/${BOOKING_ID}?g=grant.jwt`)
    expect(path).not.toContain("t=")
  })
})
