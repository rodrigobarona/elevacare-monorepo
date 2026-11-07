import { beforeEach, describe, expect, it, vi } from "vitest"
import { hashReservationToken } from "./reservation-token"

const mocks = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  updated: [{ id: "r1" }] as { id: string }[],
  emit: vi.fn(),
}))

vi.mock("@eleva/db", () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: async () => (mocks.row ? [mocks.row] : []),
  }
  return {
    main: { slotReservations: new Proxy({}, { get: (_t, k) => String(k) }) },
    withPlatformAdminContext: async (fn: (tx: unknown) => unknown) => fn(chain),
  }
})
vi.mock("@eleva/audit", () => ({
  withAudit: async (
    _o: unknown,
    fn: (tx: unknown, ctx: unknown) => Promise<unknown>
  ) => {
    const tx = {
      update: () => tx,
      set: () => tx,
      where: () => tx,
      returning: async () => mocks.updated,
    }
    return fn(tx, { emit: mocks.emit })
  },
}))

import {
  extendReservationHold,
  HOLD_EXTENSION_MS,
  MAX_HOLD_MS,
  nextHoldExpiry,
} from "./extend-reservation"

const NOW = new Date("2026-11-07T12:00:00Z")
const TOKEN = "token-abc"

function hold(overrides: Record<string, unknown> = {}) {
  return {
    orgId: "org-1",
    userId: null,
    status: "active",
    createdAt: new Date(NOW.getTime() - 4 * 60_000),
    expiresAt: new Date(NOW.getTime() + 60_000),
    capabilityHash: hashReservationToken(TOKEN),
    holdToken: "hold-1",
    expertProfileId: "exp-1",
    startsAt: new Date("2026-11-10T09:00:00Z"),
    ...overrides,
  }
}

const input = { reservationId: "r1", reservationToken: TOKEN, now: NOW }

beforeEach(() => {
  mocks.row = hold()
  mocks.updated = [{ id: "r1" }]
  mocks.emit.mockReset()
})

describe("nextHoldExpiry", () => {
  it("adds five minutes, capped at an hour after the hold started", () => {
    const created = new Date(NOW.getTime() - 10 * 60_000)
    expect(nextHoldExpiry(created, NOW)?.getTime()).toBe(
      NOW.getTime() + HOLD_EXTENSION_MS
    )
    const old = new Date(NOW.getTime() - MAX_HOLD_MS + 60_000)
    expect(nextHoldExpiry(old, NOW)?.getTime()).toBe(NOW.getTime() + 60_000)
    expect(nextHoldExpiry(new Date(NOW.getTime() - MAX_HOLD_MS), NOW)).toBe(
      null
    )
  })

  it("allows at least ten extensions (WCAG 2.2.1)", () => {
    expect(MAX_HOLD_MS / HOLD_EXTENSION_MS).toBeGreaterThanOrEqual(10)
  })
})

describe("extendReservationHold", () => {
  it("extends an active hold and audits it", async () => {
    const result = await extendReservationHold(null, input)
    expect(result).toEqual({
      ok: true,
      expiresAt: new Date(NOW.getTime() + HOLD_EXTENSION_MS),
    })
    expect(mocks.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "slot_reservation",
        action: "extended",
      })
    )
  })

  it("hides the hold from a wrong token or another user", async () => {
    expect(
      await extendReservationHold(null, { ...input, reservationToken: "nope" })
    ).toEqual({ ok: false, error: "not_found" })
    mocks.row = hold({ userId: "member-1" })
    expect(
      await extendReservationHold(null, { ...input, sessionUserId: "member-2" })
    ).toEqual({ ok: false, error: "not_found" })
  })

  it("refuses an expired or converted hold", async () => {
    mocks.row = hold({ expiresAt: new Date(NOW.getTime() - 1) })
    expect(await extendReservationHold(null, input)).toEqual({
      ok: false,
      error: "expired",
    })
    mocks.row = hold({ status: "converted" })
    expect(await extendReservationHold(null, input)).toEqual({
      ok: false,
      error: "expired",
    })
  })

  it("stops at the one-hour cap", async () => {
    mocks.row = hold({
      createdAt: new Date(NOW.getTime() - MAX_HOLD_MS + 60_000),
      expiresAt: new Date(NOW.getTime() + 60_000),
    })
    expect(await extendReservationHold(null, input)).toEqual({
      ok: false,
      error: "limit_reached",
    })
  })

  it("reports expired when the hold changes under it, without auditing", async () => {
    mocks.updated = []
    expect(await extendReservationHold(null, input)).toEqual({
      ok: false,
      error: "expired",
    })
    expect(mocks.emit).not.toHaveBeenCalled()
  })
})
