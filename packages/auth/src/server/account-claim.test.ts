import { beforeEach, describe, expect, it, vi } from "vitest"

const { getSessionFromCtx, rows, withAudit, findDefaultOrganizationId } =
  vi.hoisted(() => ({
    getSessionFromCtx: vi.fn(),
    rows: {} as Record<string, unknown[]>,
    withAudit: vi.fn(),
    findDefaultOrganizationId: vi.fn(),
  }))

vi.mock("better-auth/api", () => ({ getSessionFromCtx }))
vi.mock("@eleva/audit", () => ({ withAudit }))
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
    db: () => ({
      select: () => ({
        from: (source: { __name: string }) => ({
          where: async () => rows[source.__name] ?? [],
        }),
      }),
    }),
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

  it("refuses a same-email link to a verified account with no owner session", async () => {
    getSessionFromCtx.mockResolvedValue(null)
    const result = await guardAccountLink(
      { user: { id: "user-1" }, source: linkSource },
      context({ id: "user-1", emailVerified: true })
    )
    expect(result?.error).toBe("account_not_linked")
  })

  it("refuses when someone else is signed in", async () => {
    getSessionFromCtx.mockResolvedValue({ user: { id: "attacker" } })
    const result = await guardAccountLink(
      { user: { id: "user-1" }, source: linkSource },
      context({ id: "user-1", emailVerified: true })
    )
    expect(result?.error).toBe("account_not_linked")
  })

  it("allows the signed-in owner to link (Settings, calendar connect)", async () => {
    getSessionFromCtx.mockResolvedValue({ user: { id: "user-1" } })
    const result = await guardAccountLink(
      { user: { id: "user-1" }, source: linkSource },
      context({ id: "user-1", emailVerified: true })
    )
    expect(result).toBeUndefined()
  })

  it("lets a provider claim an unverified row", async () => {
    getSessionFromCtx.mockResolvedValue(null)
    const result = await guardAccountLink(
      { user: { id: "user-1" }, source: linkSource },
      context({ id: "user-1", emailVerified: false })
    )
    expect(result).toBeUndefined()
  })

  it("refuses when the session lookup fails", async () => {
    getSessionFromCtx.mockRejectedValue(new Error("redis down"))
    const result = await guardAccountLink(
      { user: { id: "user-1" }, source: linkSource },
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
    for (const key of Object.keys(rows)) delete rows[key]
  })

  it("skips verified accounts and owner-initiated links", async () => {
    await purgeBeforeClaim(
      google,
      context({ id: "user-1", emailVerified: true })
    )
    getSessionFromCtx.mockResolvedValue({ user: { id: "user-1" } })
    const ownerCtx = context({ id: "user-1", emailVerified: false })
    await purgeBeforeClaim(google, ownerCtx)
    expect(withAudit).not.toHaveBeenCalled()
    expect(
      ownerCtx.context.internalAdapter.deleteUserSessions
    ).not.toHaveBeenCalled()
  })

  it("skips password sign-up rows", async () => {
    const ctx = context({ id: "user-1", emailVerified: false })
    await purgeBeforeClaim({ userId: "user-1", providerId: "credential" }, ctx)
    expect(ctx.context.internalAdapter.findUserById).not.toHaveBeenCalled()
  })

  it("revokes sessions without an audit when nothing was enrolled", async () => {
    const ctx = context({ id: "user-1", emailVerified: false })
    await purgeBeforeClaim(google, ctx)
    expect(withAudit).not.toHaveBeenCalled()
    expect(ctx.context.internalAdapter.deleteUserSessions).toHaveBeenCalledWith(
      "user-1"
    )
  })

  function auditedTx(verifiedNow: boolean) {
    const deleted: string[] = []
    const emit = vi.fn()
    const update = vi.fn(() => ({ set: () => ({ where: async () => {} }) }))
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
            where: async () => {
              deleted.push(source.__name)
            },
          }),
          update,
        },
        { emit }
      )
    )
    return { deleted, emit, update }
  }

  it("revokes sessions for a Microsoft claim with nothing enrolled", async () => {
    const ctx = context({ id: "user-1", emailVerified: false })
    await purgeBeforeClaim({ userId: "user-1", providerId: "microsoft" }, ctx)
    expect(withAudit).not.toHaveBeenCalled()
    expect(ctx.context.internalAdapter.deleteUserSessions).toHaveBeenCalledWith(
      "user-1"
    )
  })

  it("aborts the claim when the owner check fails", async () => {
    rows.passkey = [{ id: "p1" }]
    getSessionFromCtx.mockRejectedValue(new Error("redis down"))
    const ctx = context({ id: "user-1", emailVerified: false })
    await expect(purgeBeforeClaim(google, ctx)).rejects.toThrow("redis down")
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("keeps everything when the row was verified meanwhile", async () => {
    rows.passkey = [{ id: "p1" }]
    const { deleted, emit } = auditedTx(true)
    const ctx = context({ id: "user-1", emailVerified: false })
    await purgeBeforeClaim(google, ctx)
    expect(deleted).toEqual([])
    expect(emit).not.toHaveBeenCalled()
    expect(
      ctx.context.internalAdapter.deleteUserSessions
    ).not.toHaveBeenCalled()
  })

  it("purges pre-verification credentials in one audited write", async () => {
    rows.account = [
      { id: "a1", providerId: "credential" },
      { id: "a2", providerId: "microsoft" },
    ]
    rows.passkey = [{ id: "p1" }]
    rows.twoFactor = [{ id: "t1" }]
    rows.apikey = [{ id: "k1" }]
    const { deleted, emit, update } = auditedTx(false)
    const ctx = context({ id: "user-1", emailVerified: false })
    await purgeBeforeClaim(google, ctx)

    expect(withAudit).toHaveBeenCalledWith(
      { orgId: "space-1", actorUserId: "user-1" },
      expect.any(Function)
    )
    expect(deleted).toEqual(["account", "passkey", "twoFactor", "apikey"])
    expect(update).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "user",
        action: "claimed",
        entityId: "user-1",
        payload: expect.objectContaining({
          removedLogins: ["credential", "microsoft"],
          removedPasskeys: 1,
        }),
      })
    )
    expect(ctx.context.internalAdapter.deleteUserSessions).toHaveBeenCalledWith(
      "user-1"
    )
  })

  it("aborts the link when the purge cannot be audited", async () => {
    rows.passkey = [{ id: "p1" }]
    findDefaultOrganizationId.mockResolvedValue(null)
    const ctx = context({ id: "user-1", emailVerified: false })
    await expect(purgeBeforeClaim(google, ctx)).rejects.toThrow(/audit/)
    expect(
      ctx.context.internalAdapter.deleteUserSessions
    ).not.toHaveBeenCalled()
  })
})
