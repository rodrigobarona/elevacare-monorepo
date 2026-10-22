import { beforeEach, describe, expect, it, vi } from "vitest"

const requireBetterAuth = vi.hoisted(() => vi.fn())
const requireRevocable = vi.hoisted(() => vi.fn())
const getAuthUserRole = vi.hoisted(() => vi.fn())

vi.mock("@eleva/auth/api-auth", () => ({
  requireApiAuth: requireBetterAuth,
  requireRevocableApiAuth: requireRevocable,
  expiredSessionCookies: () => [],
}))
vi.mock("@eleva/auth", () => ({
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(
      readonly code: string,
      message?: string
    ) {
      super(message ?? code)
    }
  },
  canMutateStaffPayouts: () => true,
}))
vi.mock("@eleva/db", () => ({ getAuthUserRole }))

import { UnauthorizedError } from "@eleva/auth"
import {
  apiAuthFailure,
  requireApiCapability,
  requireRevocableApiCapability,
  requireStaffPayoutMutator,
} from "./auth"

const SESSION = {
  authMode: "bearer",
  productLabel: "staff",
  capabilities: ["admin_payouts:refund"],
  user: { id: "user_1" },
}

beforeEach(() => {
  vi.resetAllMocks()
  requireBetterAuth.mockResolvedValue(SESSION)
  requireRevocable.mockResolvedValue(SESSION)
  getAuthUserRole.mockResolvedValue("staff_finance")
})

describe("requireRevocableApiCapability", () => {
  it("rejects a non-revocable JWT before checking capabilities", async () => {
    requireRevocable.mockRejectedValue(
      new UnauthorizedError("jwt-not-revocable", "jwt")
    )
    await expect(
      requireRevocableApiCapability(
        new Request("https://api.test/x"),
        "admin_payouts:refund"
      )
    ).rejects.toMatchObject({ code: "jwt-not-revocable" })
    expect(requireBetterAuth).not.toHaveBeenCalled()
  })

  it("enforces the capability on a revocable session", async () => {
    await expect(
      requireRevocableApiCapability(new Request("https://api.test/x"), "other")
    ).rejects.toMatchObject({ code: "missing-capability" })
    await expect(
      requireRevocableApiCapability(
        new Request("https://api.test/x"),
        "admin_payouts:refund"
      )
    ).resolves.toBe(SESSION)
  })
})

describe("requireApiCapability", () => {
  it("still accepts JWT-capable auth for reads", async () => {
    await requireApiCapability(
      new Request("https://api.test/x"),
      "admin_payouts:refund"
    )
    expect(requireBetterAuth).toHaveBeenCalledTimes(1)
    expect(requireRevocable).not.toHaveBeenCalled()
  })
})

describe("requireStaffPayoutMutator", () => {
  it("rejects a non-revocable JWT", async () => {
    requireRevocable.mockRejectedValue(
      new UnauthorizedError("jwt-not-revocable", "jwt")
    )
    await expect(
      requireStaffPayoutMutator(
        new Request("https://api.test/x"),
        "admin_payouts:refund"
      )
    ).rejects.toMatchObject({ code: "jwt-not-revocable" })
  })
})

describe("apiAuthFailure", () => {
  it("maps jwt-not-revocable to 403", async () => {
    const response = apiAuthFailure(
      new UnauthorizedError("jwt-not-revocable", "jwt"),
      {}
    )
    expect(response?.status).toBe(403)
    expect(await response?.json()).toMatchObject({ code: "jwt-not-revocable" })
  })
})
