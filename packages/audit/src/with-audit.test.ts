import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Unit tests for withAudit. The @eleva/db module is mocked so we do
 * not need a live Neon connection; we verify the contract:
 *
 *   1. withOrgAndUserContext is invoked when actorUserId is set.
 *   2. fn receives a tx + ctx.
 *   3. A call to ctx.emit() inserts an audit_outbox row with the
 *      auditId + orgId + correlation_id.
 *   4. Returning without emit throws.
 *   5. Calling emit twice in the same scope throws.
 *   6. getCorrelationId() feeds through into the ctx.
 */

describe("withAudit", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function setup(
    opts: {
      correlationId?: string
    } = {}
  ) {
    const insert = vi
      .fn()
      .mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
    const executeSpy = vi.fn().mockResolvedValue({})

    const txHandle = { insert, execute: executeSpy }

    const withOrgContext = vi.fn(
      async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
        return fn(txHandle)
      }
    )
    const withOrgAndUserContext = vi.fn(
      async (
        _orgId: string,
        _userId: string,
        fn: (tx: unknown) => Promise<unknown>
      ) => {
        return fn(txHandle)
      }
    )
    const withPlatformAdminContext = vi.fn(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(txHandle)
    )
    const withPlatformAdminUserContext = vi.fn(
      async (_userId: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn(txHandle)
    )

    vi.doMock("@eleva/db", () => ({
      withOrgContext,
      withOrgAndUserContext,
      withPlatformAdminContext,
      withPlatformAdminUserContext,
      main: {
        auditOutbox: { __isTable: true, name: "audit_outbox" },
      },
    }))
    vi.doMock("@eleva/observability", () => ({
      getCorrelationId: () => opts.correlationId ?? null,
    }))
    vi.doMock("drizzle-orm", async () => {
      const actual =
        await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm")
      return { ...actual }
    })

    const { withAudit, withPlatformAudit } = await import("./with-audit.js")
    return {
      withAudit,
      withPlatformAudit,
      withOrgContext,
      withOrgAndUserContext,
      withPlatformAdminContext,
      withPlatformAdminUserContext,
      insert,
    }
  }

  it("invokes withOrgAndUserContext with org and actor and commits one outbox row on emit", async () => {
    const { withAudit, withOrgAndUserContext, insert } = await setup({
      correlationId: "corr-1",
    })

    const result = await withAudit(
      { orgId: "org-1", actorUserId: "user-1" },
      async (_tx, ctx) => {
        await ctx.emit({
          entity: "user",
          action: "created",
          entityId: "user-1",
          payload: { email: "a@b.c" },
        })
        return "ok"
      }
    )

    expect(result).toBe("ok")
    expect(withOrgAndUserContext).toHaveBeenCalledOnce()
    expect(withOrgAndUserContext.mock.calls[0]?.[0]).toBe("org-1")
    expect(withOrgAndUserContext.mock.calls[0]?.[1]).toBe("user-1")

    expect(insert).toHaveBeenCalledOnce()
    const valuesCall = insert.mock.results[0]!.value
      .values as unknown as ReturnType<typeof vi.fn>
    expect(valuesCall).toHaveBeenCalledOnce()
    const row = valuesCall.mock.calls[0]?.[0] as {
      auditId: string
      orgId: string
      action: string
      entity: string
      entityId: string | null
      payload: Record<string, unknown>
      correlationId: string | null
      actorUserId: string | null
    }
    expect(row.orgId).toBe("org-1")
    expect(row.actorUserId).toBe("user-1")
    expect(row.entity).toBe("user")
    expect(row.action).toBe("user.created")
    expect(row.entityId).toBe("user-1")
    expect(row.payload).toEqual({ email: "a@b.c" })
    expect(row.correlationId).toBe("corr-1")
    expect(row.auditId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it("throws when fn returns without emitting", async () => {
    const { withAudit } = await setup()
    await expect(
      withAudit({ orgId: "org-1" }, async () => {
        // no emit
        return undefined
      })
    ).rejects.toThrow(/did not emit|without emitting/i)
  })

  it("throws if emit called twice", async () => {
    const { withAudit } = await setup()
    await expect(
      withAudit({ orgId: "org-1" }, async (_tx, ctx) => {
        await ctx.emit({ entity: "user", action: "created" })
        await ctx.emit({ entity: "user", action: "updated" })
      })
    ).rejects.toThrow(/already emitted/)
  })

  it("actorUserId defaults to null and payload to empty object", async () => {
    const { withAudit, withOrgContext, insert } = await setup()
    await withAudit({ orgId: "org-1" }, async (_tx, ctx) => {
      await ctx.emit({ entity: "user", action: "deleted", entityId: "user-2" })
    })
    expect(withOrgContext).toHaveBeenCalledOnce()
    expect(withOrgContext.mock.calls[0]?.[0]).toBe("org-1")
    const row = (
      insert.mock.results[0]!.value.values as unknown as ReturnType<
        typeof vi.fn
      >
    ).mock.calls[0]?.[0] as {
      actorUserId: string | null
      payload: Record<string, unknown>
    }
    expect(row.actorUserId).toBeNull()
    expect(row.payload).toEqual({})
  })

  it("withPlatformAudit uses platform-admin context without an actor", async () => {
    const {
      withPlatformAudit,
      withPlatformAdminContext,
      withPlatformAdminUserContext,
    } = await setup()
    await withPlatformAudit({ orgId: "org-1" }, async (_tx, ctx) => {
      await ctx.emit({ entity: "consent", action: "withdrawn" })
    })
    expect(withPlatformAdminContext).toHaveBeenCalledOnce()
    expect(withPlatformAdminUserContext).not.toHaveBeenCalled()
  })

  it("withPlatformAudit uses platform-admin user context when actor is set", async () => {
    const {
      withPlatformAudit,
      withPlatformAdminContext,
      withPlatformAdminUserContext,
    } = await setup()
    await withPlatformAudit(
      { orgId: "org-1", actorUserId: "user-1" },
      async (_tx, ctx) => {
        await ctx.emit({ entity: "consent", action: "withdrawn" })
      }
    )
    expect(withPlatformAdminUserContext).toHaveBeenCalledOnce()
    expect(withPlatformAdminUserContext.mock.calls[0]?.[0]).toBe("user-1")
    expect(withPlatformAdminContext).not.toHaveBeenCalled()
  })
})
