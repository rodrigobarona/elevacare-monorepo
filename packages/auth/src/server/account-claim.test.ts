import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getSessionFromCtx,
  withAudit,
  findDefaultOrganizationId,
  getPlatformAuditOrgId,
} = vi.hoisted(() => ({
  getSessionFromCtx: vi.fn(),
  withAudit: vi.fn(),
  findDefaultOrganizationId: vi.fn(),
  getPlatformAuditOrgId: vi.fn(),
}))

vi.mock("better-auth/api", () => ({ getSessionFromCtx }))
vi.mock("@eleva/audit", () => ({ withAudit, getPlatformAuditOrgId }))
vi.mock("../provision-personal-space", () => ({ findDefaultOrganizationId }))
vi.mock("@eleva/db", () => {
  const table = (name: string, columns: string[]) =>
    Object.fromEntries([
      ["__name", name],
      ...columns.map((column) => [column, `${name}.${column}`]),
    ])
  return {
    auth: {
      account: table("account", ["id", "providerId", "userId"]),
      passkey: table("passkey", ["id", "userId"]),
      twoFactor: table("twoFactor", ["id", "userId"]),
      apikey: table("apikey", ["id", "userId", "referenceId"]),
      user: table("user", ["id", "twoFactorEnabled"]),
    },
  }
})

import { guardAccountLink, purgeBeforeClaim } from "./account-claim"

function context(user: { id: string; emailVerified: boolean } | null) {
  return {
    context: {
      internalAdapter: {
        findUserById: vi.fn(async () => user),
        deleteUserSessions: vi.fn(async () => {}),
      },
    },
  } as unknown as Parameters<typeof guardAccountLink>[1] & {
    context: {
      internalAdapter: {
        deleteUserSessions: ReturnType<typeof vi.fn>
      }
    }
  }
}

const linkSource = { action: "link-account", method: "oauth" }

describe("guardAccountLink", () => {
  beforeEach(() => {
    getSessionFromCtx.mockReset()
  })

  const googleVerified = { id: "user-1", emailVerified: true }

  it("refuses a same-email link to a verified account with no owner session", async () => {
    getSessionFromCtx.mockResolvedValue(null)
    const result = await guardAccountLink(
      { user: googleVerified, source: linkSource },
      context({ id: "user-1", emailVerified: true })
    )
    expect(result?.error).toBe("account_not_linked")
  })

  it("refuses when someone else is signed in", async () => {
    getSessionFromCtx.mockResolvedValue({ user: { id: "attacker" } })
    const result = await guardAccountLink(
      { user: googleVerified, source: linkSource },
      context({ id: "user-1", emailVerified: true })
    )
    expect(result?.error).toBe("account_not_linked")
  })

  it("allows the signed-in owner to link (Settings, calendar connect)", async () => {
    getSessionFromCtx.mockResolvedValue({ user: { id: "user-1" } })
    const result = await guardAccountLink(
      { user: { id: "user-1", emailVerified: false }, source: linkSource },
      context({ id: "user-1", emailVerified: true })
    )
    expect(result).toBeUndefined()
  })

  it("lets a provider-verified email claim an unverified row", async () => {
    getSessionFromCtx.mockResolvedValue(null)
    // Own id: an approved claim stays pending for the account-create hook.
    const result = await guardAccountLink(
      { user: { id: "guest-1", emailVerified: true }, source: linkSource },
      context({ id: "guest-1", emailVerified: false })
    )
    expect(result).toBeUndefined()
  })

  it("refuses an unsigned claim when the provider has not verified the email", async () => {
    getSessionFromCtx.mockResolvedValue(null)
    for (const emailVerified of [false, undefined, "true"]) {
      const result = await guardAccountLink(
        { user: { id: "user-1", emailVerified }, source: linkSource },
        context({ id: "user-1", emailVerified: false })
      )
      expect(result?.error).toBe("account_not_linked")
    }
  })

  it("refuses when the session lookup fails", async () => {
    getSessionFromCtx.mockRejectedValue(new Error("redis down"))
    const result = await guardAccountLink(
      { user: googleVerified, source: linkSource },
      context({ id: "user-1", emailVerified: true })
    )
    expect(result?.error).toBe("account_not_linked")
  })

  it("leaves unknown users to Better Auth", async () => {
    const result = await guardAccountLink(
      { user: { id: "missing" }, source: linkSource },
      context(null)
    )
    expect(result).toBeUndefined()
    expect(getSessionFromCtx).not.toHaveBeenCalled()
  })

  it("ignores sign-up and returning sign-in", async () => {
    const ctx = context({ id: "user-1", emailVerified: true })
    for (const action of ["create-user", "sign-in"]) {
      await expect(
        guardAccountLink(
          { user: { id: "user-1" }, source: { action, method: "oauth" } },
          ctx
        )
      ).resolves.toBeUndefined()
    }
    expect(getSessionFromCtx).not.toHaveBeenCalled()
  })
})

describe("purgeBeforeClaim", () => {
  const google = { userId: "user-1", providerId: "google" }

  beforeEach(() => {
    getSessionFromCtx.mockReset().mockResolvedValue(null)
    withAudit.mockReset()
    findDefaultOrganizationId.mockReset().mockResolvedValue("space-1")
    getPlatformAuditOrgId.mockReset().mockReturnValue(null)
  })

  type Deleted = Record<string, Record<string, unknown>[]>

  function auditedTx(verifiedNow: boolean, rows: Deleted = {}) {
    const deleted: string[] = []
    const emit = vi.fn()
    const updates: { set: unknown; where: unknown }[] = []
    const update = vi.fn(() => ({
      set: (set: unknown) => ({
        where: async (where: unknown) => {
          updates.push({ set, where })
        },
      }),
    }))
    withAudit.mockImplementation(async (_opts, fn) =>
      fn(
        {
          select: () => ({
            from: () => ({
              where: () => ({
                for: async () => [{ emailVerified: verifiedNow }],
              }),
            }),
          }),
          delete: (source: { __name: string }) => ({
            where: () => ({
              returning: async () => {
                deleted.push(source.__name)
                return rows[source.__name] ?? []
              },
            }),
          }),
          update,
        },
        { emit }
      )
    )
    return { deleted, emit, update, updates }
  }

  /** Runs the guard first, as Better Auth does on the implicit link path. */
  async function approveClaim(ctx: ReturnType<typeof context>) {
    await expect(
      guardAccountLink(
        { user: { id: "user-1", emailVerified: true }, source: linkSource },
        ctx
      )
    ).resolves.toBeUndefined()
  }

  it("skips verified accounts that no claim was approved for (new users)", async () => {
    const ctx = context({ id: "user-1", emailVerified: true })
    await purgeBeforeClaim(google, ctx)
    expect(withAudit).not.toHaveBeenCalled()
    expect(
      ctx.context.internalAdapter.deleteUserSessions
    ).not.toHaveBeenCalled()
  })

  it("skips owner-initiated links", async () => {
    getSessionFromCtx.mockResolvedValue({ user: { id: "user-1" } })
    const ctx = context({ id: "user-1", emailVerified: false })
    await purgeBeforeClaim(google, ctx)
    expect(withAudit).not.toHaveBeenCalled()
    expect(
      ctx.context.internalAdapter.deleteUserSessions
    ).not.toHaveBeenCalled()
  })

  it("skips password sign-up rows", async () => {
    const ctx = context({ id: "user-1", emailVerified: false })
    await purgeBeforeClaim({ userId: "user-1", providerId: "credential" }, ctx)
    expect(ctx.context.internalAdapter.findUserById).not.toHaveBeenCalled()
  })

  it("aborts an approved claim when the row is verified before the hook", async () => {
    const guardCtx = context({ id: "user-1", emailVerified: false })
    await approveClaim(guardCtx)
    const ctx = context({ id: "user-1", emailVerified: true })
    await expect(purgeBeforeClaim(google, ctx)).rejects.toThrow(/raced/)
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("aborts the claim when the row is verified inside the transaction", async () => {
    const { deleted, emit } = auditedTx(true)
    const ctx = context({ id: "user-1", emailVerified: false })
    await approveClaim(ctx)
    await expect(purgeBeforeClaim(google, ctx)).rejects.toThrow(/raced/)
    expect(deleted).toEqual([])
    expect(emit).not.toHaveBeenCalled()
  })

  it("audits a claim even when nothing was enrolled", async () => {
    const { emit } = auditedTx(false)
    const ctx = context({ id: "user-1", emailVerified: false })
    await purgeBeforeClaim({ userId: "user-1", providerId: "microsoft" }, ctx)
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "claimed",
        payload: expect.objectContaining({
          providerId: "microsoft",
          removedLogins: [],
          removedPasskeys: 0,
          sessionsRevoked: true,
        }),
      })
    )
    expect(
      ctx.context.internalAdapter.deleteUserSessions
    ).toHaveBeenCalledTimes(2)
  })

  it("falls back to the platform audit org when the user has no Space", async () => {
    auditedTx(false)
    findDefaultOrganizationId.mockResolvedValue(null)
    getPlatformAuditOrgId.mockReturnValue("platform-org")
    await purgeBeforeClaim(
      google,
      context({ id: "user-1", emailVerified: false })
    )
    expect(withAudit).toHaveBeenCalledWith(
      { orgId: "platform-org", actorUserId: "user-1" },
      expect.any(Function)
    )
  })

  it("aborts the claim when the owner check fails", async () => {
    getSessionFromCtx.mockRejectedValue(new Error("redis down"))
    const ctx = context({ id: "user-1", emailVerified: false })
    await expect(purgeBeforeClaim(google, ctx)).rejects.toThrow("redis down")
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("purges pre-verification credentials in one audited write", async () => {
    const { deleted, emit, updates } = auditedTx(false, {
      account: [{ providerId: "credential" }, { providerId: "microsoft" }],
      passkey: [{ id: "p1" }],
      twoFactor: [{ id: "t1" }],
      apikey: [{ id: "k1" }, { id: "k2" }],
    })
    const ctx = context({ id: "user-1", emailVerified: false })
    await approveClaim(ctx)
    await purgeBeforeClaim(google, ctx)

    expect(withAudit).toHaveBeenCalledWith(
      { orgId: "space-1", actorUserId: "user-1" },
      expect.any(Function)
    )
    expect(deleted).toEqual(["account", "passkey", "twoFactor", "apikey"])
    expect(updates).toHaveLength(1)
    expect(updates[0]?.set).toEqual({ twoFactorEnabled: false })
    expect(JSON.stringify(updates[0]?.where)).toContain("user-1")
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "user",
        action: "claimed",
        entityId: "user-1",
        payload: expect.objectContaining({
          removedLogins: ["credential", "microsoft"],
          removedPasskeys: 1,
          removedTwoFactor: 1,
          removedApiKeys: 2,
        }),
      })
    )
    expect(ctx.context.internalAdapter.deleteUserSessions).toHaveBeenCalledWith(
      "user-1"
    )
    expect(
      ctx.context.internalAdapter.deleteUserSessions
    ).toHaveBeenCalledTimes(2)
  })

  it("aborts the link when the purge cannot be audited", async () => {
    findDefaultOrganizationId.mockResolvedValue(null)
    const ctx = context({ id: "user-1", emailVerified: false })
    await expect(purgeBeforeClaim(google, ctx)).rejects.toThrow(/audit/)
    expect(
      ctx.context.internalAdapter.deleteUserSessions
    ).not.toHaveBeenCalled()
  })
})
