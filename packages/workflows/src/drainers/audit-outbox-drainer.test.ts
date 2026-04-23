import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Audit outbox drainer contract tests. We mock @eleva/db so the tests
 * do not need a live Neon project; the invariants verified here are:
 *
 * - When there are 3 pending rows, all 3 are inserted into the audit
 *   DB with onConflictDoNothing and the outbox rows are marked shipped.
 * - If the audit DB insert throws for a row, only that row fails; the
 *   rest still succeed, and captureException is called with the row id.
 * - On the Nth attempt (attempts >= maxAttempts) the row is marked
 *   'failed' in the outbox.
 * - Heartbeat is fired even on zero rows.
 * - Idempotency: re-running over the same pending set (simulated by
 *   returning the same rows again) yields the same shipped count.
 */

function fakeRow(id: string, attempts = 0) {
  return {
    id,
    auditId: `audit-${id}`,
    orgId: "org-1",
    actorUserId: "user-1",
    action: "user.created",
    entity: "user",
    entityId: id,
    payload: { email: "a@b.c" },
    correlationId: "corr-1",
    status: "pending" as const,
    attempts,
    lastError: null,
    shippedAt: null,
    createdAt: new Date(),
  }
}

describe("drainAuditOutbox", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function setup(
    pendingRows: ReturnType<typeof fakeRow>[],
    opts: {
      auditInsertShouldFail?: string[]
    } = {}
  ) {
    const heartbeat = vi.fn().mockResolvedValue(undefined)
    const captureException = vi.fn().mockResolvedValue(undefined)

    const mainSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(pendingRows),
    }
    const updateSetWhere = vi.fn().mockResolvedValue(undefined)
    const mainUpdateChain = {
      set: vi.fn().mockReturnValue({ where: updateSetWhere }),
    }
    const mainDb = {
      select: vi.fn().mockReturnValue(mainSelectChain),
      update: vi.fn().mockReturnValue(mainUpdateChain),
    }

    const auditValues = vi.fn()
    const auditInsertChain = {
      values: vi.fn().mockImplementation((row: { auditId: string }) => ({
        onConflictDoNothing: vi.fn().mockImplementation(async () => {
          if (opts.auditInsertShouldFail?.includes(row.auditId)) {
            throw new Error(`injected failure for ${row.auditId}`)
          }
          auditValues(row)
          return undefined
        }),
      })),
    }
    const audDb = {
      insert: vi.fn().mockReturnValue(auditInsertChain),
    }

    vi.doMock("@eleva/db", () => ({
      db: () => mainDb,
      auditDb: () => audDb,
      main: {
        auditOutbox: {
          __: "main.auditOutbox",
          status: { __: "status" },
          attempts: { __: "attempts" },
          id: { __: "id" },
        },
      },
      audit: {
        auditEvents: {
          __: "audit.auditEvents",
          auditId: { __: "auditId" },
        },
      },
    }))
    vi.doMock("@eleva/observability", () => ({
      heartbeat,
      captureException,
    }))
    vi.doMock("drizzle-orm", async () => {
      const actual =
        await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm")
      return { ...actual }
    })

    const { drainAuditOutbox } = await import("./audit-outbox-drainer.js")
    return {
      drainAuditOutbox,
      mainDb,
      audDb,
      heartbeat,
      captureException,
      updateSetWhere,
      auditValues,
    }
  }

  it("ships every pending row to audit DB and marks them shipped", async () => {
    const rows = [fakeRow("a"), fakeRow("b"), fakeRow("c")]
    const { drainAuditOutbox, heartbeat, auditValues, updateSetWhere } =
      await setup(rows)
    const result = await drainAuditOutbox()
    expect(result).toEqual({ processed: 3, shipped: 3, failed: 0, skipped: 0 })
    expect(auditValues).toHaveBeenCalledTimes(3)
    expect(heartbeat).toHaveBeenCalledWith("audit-outbox-drainer")
    // one bulk shipped-update
    expect(updateSetWhere).toHaveBeenCalledTimes(1)
  })

  it("isolates a per-row failure to that row", async () => {
    const rows = [fakeRow("a"), fakeRow("b"), fakeRow("c")]
    const { drainAuditOutbox, captureException, auditValues } = await setup(
      rows,
      {
        auditInsertShouldFail: ["audit-b"],
      }
    )
    const result = await drainAuditOutbox()
    expect(result.processed).toBe(3)
    expect(result.shipped).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.failed).toBe(0)
    expect(auditValues).toHaveBeenCalledTimes(2)
    expect(captureException).toHaveBeenCalledOnce()
  })

  it("marks a row failed once attempts hit maxAttempts", async () => {
    const rows = [fakeRow("a", 4)]
    const { drainAuditOutbox } = await setup(rows, {
      auditInsertShouldFail: ["audit-a"],
    })
    const result = await drainAuditOutbox({ maxAttempts: 5 })
    expect(result.failed).toBe(1)
    expect(result.skipped).toBe(0)
  })

  it("fires heartbeat even on zero pending rows", async () => {
    const { drainAuditOutbox, heartbeat } = await setup([])
    const result = await drainAuditOutbox()
    expect(result).toEqual({ processed: 0, shipped: 0, failed: 0, skipped: 0 })
    expect(heartbeat).toHaveBeenCalledOnce()
  })

  it("accepts a custom heartbeat name", async () => {
    const { drainAuditOutbox, heartbeat } = await setup([])
    await drainAuditOutbox({ heartbeatName: "custom-name" })
    expect(heartbeat).toHaveBeenCalledWith("custom-name")
  })
})
