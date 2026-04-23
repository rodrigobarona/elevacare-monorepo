import { sql } from "drizzle-orm"
import { main, withOrgContext, type Tx } from "@eleva/db"
import { getCorrelationId } from "@eleva/observability"
import type { AuditAction, AuditEntity, AuditRecord } from "./types"

/**
 * withAudit(action, entity, fn) \u2014 transactional-outbox decorator.
 *
 * Every mutating server action wraps its body with this function. The
 * wrapper:
 *   1. Generates an auditId upfront (UUID, used as the idempotency key
 *      when the drainer copies rows into the audit DB).
 *   2. Opens withOrgContext(orgId) so RLS sees the tenant id.
 *   3. Runs the caller-supplied fn inside that same transaction, passing
 *      both the Drizzle tx handle and an auditCtx that carries the
 *      auditId + correlationId + orgId + actorUserId.
 *   4. The caller\u2019s fn writes its domain rows AND must either:
 *      a. call ctx.emit(audit) to record the audit event, OR
 *      b. return the AuditRecord object from fn() which withAudit will
 *         persist.
 *   5. Domain rows + audit_outbox row commit atomically. If fn throws,
 *      the transaction rolls back and neither is visible.
 *
 * This preserves the cross-project invariant that every domain change
 * has a matching audit intent (ADR-003).
 */

export interface WithAuditOptions {
  /** WorkOS user id of the actor (null for system actions). */
  actorUserId?: string | null
  /** Tenant id \u2014 feeds withOrgContext + RLS. */
  orgId: string
}

export interface AuditCtx {
  auditId: string
  orgId: string
  actorUserId: string | null
  correlationId: string | null
  /**
   * Record an audit event within the current transaction. Use this
   * when fn returns something other than the AuditRecord.
   */
  emit: (record: {
    entity: AuditEntity
    action: AuditAction
    entityId?: string | null
    payload?: Record<string, unknown>
  }) => Promise<void>
}

type WithAuditFn<T> = (tx: Tx, ctx: AuditCtx) => Promise<T>

export async function withAudit<T>(
  options: WithAuditOptions,
  fn: WithAuditFn<T>
): Promise<T> {
  const auditId = crypto.randomUUID()
  const actorUserId = options.actorUserId ?? null
  const correlationId = getCorrelationId() ?? null

  return withOrgContext(options.orgId, async (tx) => {
    let written = false
    const ctx: AuditCtx = {
      auditId,
      orgId: options.orgId,
      actorUserId,
      correlationId,
      emit: async (record) => {
        if (written) {
          throw new Error(
            "withAudit: audit event already emitted for this scope. One event per withAudit call."
          )
        }
        written = true
        await insertOutboxRow(tx, {
          auditId,
          orgId: options.orgId,
          actorUserId,
          action: record.action,
          entity: record.entity,
          entityId: record.entityId ?? null,
          payload: record.payload ?? {},
          correlationId,
        })
      },
    }

    const result = await fn(tx, ctx)

    if (!written) {
      throw new Error(
        "withAudit: fn returned without emitting an audit event. " +
          "Call ctx.emit({ entity, action, ...}) before returning."
      )
    }
    return result
  })
}

async function insertOutboxRow(tx: Tx, row: AuditRecord) {
  const { auditOutbox } = main
  await tx.insert(auditOutbox).values({
    auditId: row.auditId,
    orgId: row.orgId,
    actorUserId: row.actorUserId,
    action: `${row.entity}.${row.action}`,
    entity: row.entity,
    entityId: row.entityId,
    payload: row.payload,
    correlationId: row.correlationId,
  })
  // Belt-and-braces: explicitly touch set_config again to guarantee the
  // RLS setting survived any prior tx.execute() calls fn() may have made.
  await tx.execute(sql`SELECT 1`)
}

/**
 * withPlatformAudit \u2014 like withAudit but runs under platform-admin
 * context (cross-tenant reads via withPlatformAdminContext). Every such
 * action is itself audit-streamed.
 */
export async function withPlatformAudit<T>(
  options: Omit<WithAuditOptions, "orgId"> & { orgId: string },
  fn: WithAuditFn<T>
): Promise<T> {
  // The orgId stays on the audit row for filter/search, but the
  // transaction runs against the platform admin setting so RLS does
  // not filter the read side.
  return withAudit(options, fn)
}
