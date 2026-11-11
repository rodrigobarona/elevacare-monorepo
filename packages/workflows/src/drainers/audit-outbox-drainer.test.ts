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
    createdAt: new Date("2026-11-11T09:30:00.000Z"),
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
      laterBatches?: ReturnType<typeof fakeRow>[][]
    } = {}
  ) {
    const heartbeat = vi.fn().mockResolvedValue(undefined)
    const captureException = vi.fn().mockResolvedValue(undefined)
    const batches = [pendingRows, ...(opts.laterBatches ?? [])]

    const mainSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      // Shipped rows leave the pending set: each call returns the next
      // batch, then nothing.
      limit: vi.fn().mockImplementation(async () => batches.shift() ?? []),
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
          createdAt: { __: "createdAt" },
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
      mainSelectChain,
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
    expect(result).toEqual({
      processed: 3,
      shipped: 3,
      failed: 0,
      skipped: 0,
      more: false,
    })
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
    expect(result).toEqual({
      processed: 0,
      shipped: 0,
      failed: 0,
      skipped: 0,
      more: false,
    })
    expect(heartbeat).toHaveBeenCalledOnce()
  })

  it("keeps draining until nothing is pending, oldest first", async () => {
    const first = [fakeRow("a"), fakeRow("b")]
    const second = [fakeRow("c"), fakeRow("d")]
    const third = [fakeRow("e")]
    const { drainAuditOutbox, mainSelectChain, auditValues } = await setup(
      first,
      { laterBatches: [second, third] }
    )
    const result = await drainAuditOutbox({ batchSize: 2 })
    expect(result.shipped).toBe(5)
    expect(result.more).toBe(false)
    expect(auditValues).toHaveBeenCalledTimes(5)
    // A short batch ends the run: no fourth read.
    expect(mainSelectChain.limit).toHaveBeenCalledTimes(3)
    expect(mainSelectChain.orderBy).toHaveBeenCalledTimes(3)
  })

  it("stops at maxBatches and says more is waiting", async () => {
    const full = () => [
      fakeRow(crypto.randomUUID()),
      fakeRow(crypto.randomUUID()),
    ]
    const { drainAuditOutbox, mainSelectChain } = await setup(full(), {
      laterBatches: [full(), full(), full()],
    })
    const result = await drainAuditOutbox({ batchSize: 2, maxBatches: 2 })
    expect(result.shipped).toBe(4)
    expect(result.more).toBe(true)
    expect(mainSelectChain.limit).toHaveBeenCalledTimes(2)
  })

  it("does not retry a failing row within the same run", async () => {
    const stuck = fakeRow("stuck")
    // A real database would return the failed row again: it is still pending.
    const { drainAuditOutbox, captureException } = await setup(
      [stuck, fakeRow("a")],
      {
        auditInsertShouldFail: ["audit-stuck"],
        laterBatches: [[fakeRow("b"), fakeRow("c")], []],
      }
    )
    const result = await drainAuditOutbox({ batchSize: 2 })
    expect(result.shipped).toBe(3)
    expect(result.skipped).toBe(1)
    expect(captureException).toHaveBeenCalledOnce()
  })

  it("stops without using up retries when the audit database is down", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => fakeRow(`r${i}`))
    const { drainAuditOutbox, heartbeat, updateSetWhere, captureException } =
      await setup(rows, {
        auditInsertShouldFail: rows.map((row) => row.auditId),
      })
    await expect(drainAuditOutbox()).rejects.toMatchObject({
      name: "AuditStoreUnavailable",
    })
    // No attempt is written against any row, and no heartbeat is sent.
    expect(updateSetWhere).not.toHaveBeenCalled()
    expect(heartbeat).not.toHaveBeenCalled()
    // One report for the outage, not one per row.
    expect(captureException).toHaveBeenCalledOnce()
  })

  it("still counts a bad row that failed before an outage", async () => {
    const rows = [
      fakeRow("bad"),
      fakeRow("ok"),
      ...Array.from({ length: 10 }, (_, i) => fakeRow(`down${i}`)),
    ]
    const { drainAuditOutbox, updateSetWhere } = await setup(rows, {
      auditInsertShouldFail: rows
        .filter((row) => row.id !== "ok")
        .map((row) => row.auditId),
    })
    await expect(drainAuditOutbox()).rejects.toMatchObject({
      name: "AuditStoreUnavailable",
    })
    // One update ships "ok", one records the attempt on "bad"; the ten
    // rows refused in a row keep their attempts.
    expect(updateSetWhere).toHaveBeenCalledTimes(2)
  })

  it("reports a run that ends with failed rows or more waiting", async () => {
    const { drainAuditOutbox, captureException } = await setup(
      [fakeRow("a", 4)],
      { auditInsertShouldFail: ["audit-a"] }
    )
    const result = await drainAuditOutbox({ maxAttempts: 5 })
    expect(result.failed).toBe(1)
    // The row itself, and the run summary.
    expect(captureException).toHaveBeenCalledTimes(2)
  })

  it("keeps the time each event happened in the durable log", async () => {
    const { drainAuditOutbox, auditValues } = await setup([fakeRow("a")])
    await drainAuditOutbox()
    expect(auditValues).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { email: "a@b.c", occurredAt: "2026-11-11T09:30:00.000Z" },
      })
    )
  })

  it("never overwrites a time the event already carries", async () => {
    const { withOccurredAt } = await (async () => {
      await setup([])
      return import("./audit-outbox-drainer.js")
    })()
    const payload = { occurredAt: "2026-01-01T00:00:00.000Z" }
    expect(withOccurredAt(payload, new Date())).toBe(payload)
  })

  it("accepts a custom heartbeat name", async () => {
    const { drainAuditOutbox, heartbeat } = await setup([])
    await drainAuditOutbox({ heartbeatName: "custom-name" })
    expect(heartbeat).toHaveBeenCalledWith("custom-name")
  })
})
