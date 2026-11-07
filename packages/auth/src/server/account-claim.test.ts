import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getSessionFromCtx,
  withAudit,
  findDefaultOrganizationId,
  getPlatformAuditOrgId,
  userRows,
} = vi.hoisted(() => ({
  getSessionFromCtx: vi.fn(),
  withAudit: vi.fn(),
  findDefaultOrganizationId: vi.fn(),
  getPlatformAuditOrgId: vi.fn(),
  userRows: [] as { emailVerified: boolean }[],
}))

vi.mock("better-auth/api", () => ({
  getSessionFromCtx,
  APIError: class extends Error {
    constructor(
      readonly status: string,
      readonly body: { code: string; message: string }
    ) {
      super(body.message)
    }
  },
}))
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
      user: table("user", ["id", "twoFactorEnabled", "emailVerified"]),
    },
    db: () => ({
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => userRows }),
        }),
      }),
    }),
  }
})

import { eq, or } from "drizzle-orm"
import { auth } from "@eleva/db"
import {
  guardAccountLink,
  purgeBeforeClaim,
  refuseUnverifiedSession,
} from "./account-claim"

const LONG_AGO = new Date("2026-01-01T00:00:00Z")

function context(
  user: { id: string; emailVerified: boolean; createdAt?: Date } | null
) {
  return {
    context: {
      internalAdapter: {
        findUserById: vi.fn(async () =>
          user ? { createdAt: LONG_AGO, ...user } : null
        ),
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

const linkSource = {
  action: "link-account",
  method: "oauth",
  oauth: { providerId: "google" },
}

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

  it("ignores returning sign-in", async () => {
    const ctx = context({ id: "user-1", emailVerified: true })
    await expect(
      guardAccountLink(
        {
          user: { id: "user-1" },
          source: { action: "sign-in", method: "oauth" },
        },
        ctx
      )
    ).resolves.toBeUndefined()
    expect(getSessionFromCtx).not.toHaveBeenCalled()
  })

  it("refuses a new provider account whose email the provider has not verified", async () => {
    const ctx = context(null)
    for (const method of ["oauth", "sso-oidc"]) {
      const result = await guardAccountLink(
        {
          user: { emailVerified: false },
          source: { action: "create-user", method },
        },
        ctx
      )
      expect(result?.error).toBe("email_not_verified")
    }
  })

  it("allows provider sign-up with a verified email and email sign-up", async () => {
    const ctx = context(null)
    await expect(
      guardAccountLink(
        {
          user: { emailVerified: true },
          source: { action: "create-user", method: "oauth" },
        },
        ctx
      )
    ).resolves.toBeUndefined()
    for (const method of ["email-password", "magic-link"]) {
      await expect(
        guardAccountLink(
          {
            user: { emailVerified: false },
            source: { action: "create-user", method },
          },
          ctx
        )
      ).resolves.toBeUndefined()
    }
    expect(getSessionFromCtx).not.toHaveBeenCalled()
  })

  it("refuses an unsigned claim with no provider id", async () => {
    getSessionFromCtx.mockResolvedValue(null)
    const result = await guardAccountLink(
      {
        user: { id: "user-2", emailVerified: true },
        source: { action: "link-account", method: "oauth" },
      },
      context({ id: "user-2", emailVerified: false })
    )
    expect(result?.error).toBe("account_not_linked")
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
    const wheres: Record<string, unknown> = {}
    const emit = vi.fn()
    const updates: { table: unknown; set: unknown; where: unknown }[] = []
    const update = vi.fn((table: unknown) => ({
      set: (set: unknown) => ({
        where: async (where: unknown) => {
          updates.push({ table, set, where })
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
            where: (where: unknown) => ({
              returning: async () => {
                deleted.push(source.__name)
                wheres[source.__name] = where
                return rows[source.__name] ?? []
              },
            }),
          }),
          update,
        },
        { emit }
      )
    )
    return { deleted, wheres, emit, update, updates }
  }

  /** Runs the guard first, as Better Auth does on the implicit link path. */
  async function approveClaim(
    ctx: ReturnType<typeof context>,
    providerId = "google"
  ) {
    await expect(
      guardAccountLink(
        {
          user: { id: "user-1", emailVerified: true },
          source: { ...linkSource, oauth: { providerId } },
        },
        ctx
      )
    ).resolves.toBeUndefined()
  }

  it("skips a brand-new provider sign-up (verified, created in this request)", async () => {
    const ctx = context({
      id: "user-1",
      emailVerified: true,
      createdAt: new Date(),
    })
    await purgeBeforeClaim(google, ctx)
    expect(withAudit).not.toHaveBeenCalled()
    expect(
      ctx.context.internalAdapter.deleteUserSessions
    ).not.toHaveBeenCalled()
  })

  it("refuses a verified older row reached without its owner or a claim", async () => {
    // A claim approval lost to a concurrent request: verification still
    // aborts the link.
    const ctx = context({ id: "user-1", emailVerified: true })
    await expect(purgeBeforeClaim(google, ctx)).rejects.toThrow(/raced/)
  })

  it("never lets an owner-initiated link consume a pending claim", async () => {
    const unsignedCtx = context({ id: "user-1", emailVerified: false })
    await approveClaim(unsignedCtx)
    getSessionFromCtx.mockResolvedValueOnce({ user: { id: "user-1" } })
    await purgeBeforeClaim(
      google,
      context({ id: "user-1", emailVerified: true })
    )
    expect(withAudit).not.toHaveBeenCalled()
    // The unsigned claim still finds its approval and aborts once verified,
    // even on a row young enough to pass as a new sign-up without it.
    await expect(
      purgeBeforeClaim(
        google,
        context({ id: "user-1", emailVerified: true, createdAt: new Date() })
      )
    ).rejects.toThrow(/raced/)
  })

  it("skips owner-initiated links", async () => {
    getSessionFromCtx.mockResolvedValue({ user: { id: "user-1" } })
    const ctx = context({ id: "user-1", emailVerified: false })
    await approveClaim(ctx)
    await purgeBeforeClaim(google, ctx)
    expect(withAudit).not.toHaveBeenCalled()
    expect(
      ctx.context.internalAdapter.deleteUserSessions
    ).not.toHaveBeenCalled()
  })

  it("skips a new OAuth user whose provider email is unverified", async () => {
    // createOAuthUser inserts the user, then the account, with no guard call
    // and before the personal Space exists.
    const ctx = context({ id: "user-1", emailVerified: false })
    await purgeBeforeClaim({ userId: "user-1", providerId: "microsoft" }, ctx)
    expect(withAudit).not.toHaveBeenCalled()
    expect(findDefaultOrganizationId).not.toHaveBeenCalled()
    expect(
      ctx.context.internalAdapter.deleteUserSessions
    ).not.toHaveBeenCalled()
  })

  it("does not purge for a different provider than the approved claim", async () => {
    const ctx = context({ id: "user-1", emailVerified: false })
    await approveClaim(ctx, "google")
    await purgeBeforeClaim({ userId: "user-1", providerId: "microsoft" }, ctx)
    expect(withAudit).not.toHaveBeenCalled()
    // The google claim is still pending and purges when its account lands.
    auditedTx(false)
    await purgeBeforeClaim(google, ctx)
    expect(withAudit).toHaveBeenCalledTimes(1)
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
    await approveClaim(ctx, "microsoft")
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
    const ctx = context({ id: "user-1", emailVerified: false })
    await approveClaim(ctx)
    await purgeBeforeClaim(google, ctx)
    expect(withAudit).toHaveBeenCalledWith(
      { orgId: "platform-org", actorUserId: "user-1" },
      expect.any(Function)
    )
  })

  it("purges pre-verification credentials in one audited write", async () => {
    const { deleted, wheres, emit, updates } = auditedTx(false, {
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
    const same = (actual: unknown, expected: unknown) =>
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected))
    same(wheres.account, eq(auth.account.userId, "user-1"))
    same(wheres.passkey, eq(auth.passkey.userId, "user-1"))
    same(wheres.twoFactor, eq(auth.twoFactor.userId, "user-1"))
    same(
      wheres.apikey,
      or(
        eq(auth.apikey.userId, "user-1"),
        eq(auth.apikey.referenceId, "user-1")
      )
    )
    expect(updates).toHaveLength(1)
    expect(updates[0]?.table).toBe(auth.user)
    expect(updates[0]?.set).toEqual({ twoFactorEnabled: false })
    same(updates[0]?.where, eq(auth.user.id, "user-1"))
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
    await approveClaim(ctx)
    await expect(purgeBeforeClaim(google, ctx)).rejects.toThrow(/audit/)
    expect(
      ctx.context.internalAdapter.deleteUserSessions
    ).not.toHaveBeenCalled()
  })
})

describe("refuseUnverifiedSession", () => {
  beforeEach(() => {
    userRows.length = 0
  })

  it("lets a verified user sign in", async () => {
    userRows.push({ emailVerified: true })
    await expect(
      refuseUnverifiedSession({ userId: "user-1" })
    ).resolves.toBeUndefined()
  })

  it("refuses a session for an unverified or missing user", async () => {
    userRows.push({ emailVerified: false })
    await expect(refuseUnverifiedSession({ userId: "user-1" })).rejects.toThrow(
      /Confirm your email/
    )
    userRows.length = 0
    await expect(
      refuseUnverifiedSession({ userId: "missing" })
    ).rejects.toThrow(/Confirm your email/)
  })
})
