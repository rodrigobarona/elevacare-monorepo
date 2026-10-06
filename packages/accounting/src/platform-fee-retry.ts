import { and, eq } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import { getFlag } from "@eleva/flags"
import {
  issuePlatformFeeInvoice,
  type IssuePlatformFeeInvoiceResult,
} from "./platform-fee-issue"
import type { PlatformFeeInvoiceStatus } from "./platform-fee-invoices"

export type PlatformFeeRetryCode =
  | "not_found"
  | "flag_disabled"
  | "not_retryable"
  | "conflict"

export class PlatformFeeRetryError extends Error {
  readonly code: PlatformFeeRetryCode
  readonly status: 403 | 404 | 409

  constructor(code: PlatformFeeRetryCode, message: string) {
    super(message)
    this.name = "PlatformFeeRetryError"
    this.code = code
    this.status =
      code === "not_found" ? 404 : code === "flag_disabled" ? 403 : 409
  }
}

export function isPlatformFeeRetryError(
  err: unknown
): err is PlatformFeeRetryError {
  return err instanceof PlatformFeeRetryError
}

/**
 * Staff may re-run closed-gate classification on rows that never became a
 * fiscal document. Issued, credited and D-09 historical rows are final.
 */
export function canRetryPlatformFeeInvoice(
  status: PlatformFeeInvoiceStatus
): boolean {
  switch (status) {
    case "pending":
    case "failed":
    case "blocked":
    case "skipped":
    case "dead_lettered":
      return true
    case "issued":
    case "credited":
    case "legacy":
    case "legacy_missing":
      return false
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

type RetryRow = {
  id: string
  orgId: string
  bookingPaymentId: string
  status: PlatformFeeInvoiceStatus
  error: string | null
}

/**
 * Staff replay of one platform-fee row. Resets it to `pending` (audited,
 * compare-and-set on the observed status), then re-runs the closed-gate
 * `issuePlatformFeeInvoice`. Never POSTs a TOConline sales document.
 */
export async function retryPlatformFeeInvoice(input: {
  invoiceId: string
  actorUserId: string
}): Promise<IssuePlatformFeeInvoiceResult> {
  if (!(await getFlag("ff.toconline_invoicing_enabled"))) {
    throw new PlatformFeeRetryError(
      "flag_disabled",
      "platform-fee invoicing is not enabled"
    )
  }

  const row = await withPlatformAdminContext(async (tx) => {
    const [found] = await tx
      .select({
        id: main.platformFeeInvoices.id,
        orgId: main.platformFeeInvoices.orgId,
        bookingPaymentId: main.platformFeeInvoices.bookingPaymentId,
        status: main.platformFeeInvoices.status,
        error: main.platformFeeInvoices.error,
      })
      .from(main.platformFeeInvoices)
      .where(eq(main.platformFeeInvoices.id, input.invoiceId))
      .limit(1)
    return (found as RetryRow | undefined) ?? null
  })
  if (!row) {
    throw new PlatformFeeRetryError(
      "not_found",
      "platform-fee invoice not found"
    )
  }
  if (!canRetryPlatformFeeInvoice(row.status)) {
    throw new PlatformFeeRetryError(
      "not_retryable",
      `platform-fee invoice is ${row.status}`
    )
  }

  if (row.status !== "pending") {
    const claimed = await transitionStatus({
      row,
      from: row.status,
      to: "pending",
      error: null,
      actorUserId: input.actorUserId,
      reason: "staff_retry",
    })
    if (!claimed) {
      throw new PlatformFeeRetryError(
        "conflict",
        "platform-fee invoice changed during retry"
      )
    }
  }

  let result: IssuePlatformFeeInvoiceResult
  try {
    result = await issuePlatformFeeInvoice({
      bookingPaymentId: row.bookingPaymentId,
    })
  } catch (err) {
    await restoreAfterRetry(row, input.actorUserId)
    throw err
  }
  if (!result.invoice) {
    await restoreAfterRetry(row, input.actorUserId)
  }
  return result
}

async function restoreAfterRetry(
  row: RetryRow,
  actorUserId: string
): Promise<void> {
  if (row.status === "pending") return
  await transitionStatus({
    row,
    from: "pending",
    to: row.status,
    error: row.error,
    actorUserId,
    reason: "staff_retry_not_recorded",
  })
}

async function transitionStatus(input: {
  row: RetryRow
  from: PlatformFeeInvoiceStatus
  to: PlatformFeeInvoiceStatus
  error: string | null
  actorUserId: string
  reason: "staff_retry" | "staff_retry_not_recorded"
}): Promise<boolean> {
  return withPlatformAudit(
    { orgId: input.row.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const updated = await tx
        .update(main.platformFeeInvoices)
        .set({ status: input.to, error: input.error, updatedAt: new Date() })
        .where(
          and(
            eq(main.platformFeeInvoices.id, input.row.id),
            eq(main.platformFeeInvoices.status, input.from)
          )
        )
        .returning({ id: main.platformFeeInvoices.id })
      await ctx.emit({
        entity: "invoice",
        action: "status_changed",
        entityId: input.row.id,
        payload: {
          kind: "platform_fee",
          bookingPaymentId: input.row.bookingPaymentId,
          from: input.from,
          to: input.to,
          reason: input.reason,
          claimed: updated.length > 0,
        },
      })
      return updated.length > 0
    }
  )
}
