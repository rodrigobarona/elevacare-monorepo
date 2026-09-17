import { and, eq, isNull } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import { TOC_V1_AUTO_FINALIZE_BLOCKED } from "./adapters/toconline/issuance-gate"
import {
  isExpertInvoiceOpError,
  retryExpertInvoice,
  type ExpertInvoiceStatus,
} from "./invoice-ops"

export const INVOICING_RETRY_WORKFLOW_NAME = "invoicing-retry"
export const INVOICING_RETRY_BATCH_SIZE = 50
export const INVOICING_RETRY_MAX_ATTEMPTS = 10
export const INVOICING_RETRY_MIN_AGE_MS = 30 * 60 * 1000

export type FailedInvoiceRetryAction = "retry" | "dead_letter" | "too_recent"

export type InvoicingRetryResult = {
  scanned: number
  retried: number
  skipped: number
  blocked: number
  deadLettered: number
  errors: number
}

type FailedInvoiceCandidate = {
  id: string
  bookingId: string
  orgId: string
  attempts: number
  updatedAt: Date
  error: string | null
}

export function classifyFailedInvoiceForRetry(input: {
  attempts: number
  updatedAt: Date
  now: Date
  maxAttempts?: number
  minAgeMs?: number
}): FailedInvoiceRetryAction {
  const maxAttempts = input.maxAttempts ?? INVOICING_RETRY_MAX_ATTEMPTS
  if (input.attempts >= maxAttempts) return "dead_letter"
  const minAgeMs = input.minAgeMs ?? INVOICING_RETRY_MIN_AGE_MS
  const cutoff = new Date(input.now.getTime() - minAgeMs)
  if (input.updatedAt > cutoff) return "too_recent"
  return "retry"
}

export function classifyRetryResult(input: {
  status: ExpertInvoiceStatus
  error: string | null
}): "retried" | "blocked" | "skipped" {
  if (input.error === TOC_V1_AUTO_FINALIZE_BLOCKED) return "blocked"
  switch (input.status) {
    case "failed":
    case "pending":
    case "issued":
      return "retried"
    case "manual_pending":
    case "manual_issued":
      return "skipped"
    default: {
      const _exhaustive: never = input.status
      return _exhaustive
    }
  }
}

export async function retryFailedExpertInvoices(
  options: {
    now?: Date
    batchSize?: number
    maxAttempts?: number
    minAgeMs?: number
  } = {}
): Promise<InvoicingRetryResult> {
  const now = options.now ?? new Date()
  const batchSize = options.batchSize ?? INVOICING_RETRY_BATCH_SIZE
  const maxAttempts = options.maxAttempts ?? INVOICING_RETRY_MAX_ATTEMPTS
  const minAgeMs = options.minAgeMs ?? INVOICING_RETRY_MIN_AGE_MS

  const candidates = await withPlatformAdminContext(async (tx) => {
    return tx
      .select({
        id: main.expertInvoices.id,
        bookingId: main.expertInvoices.bookingId,
        orgId: main.expertInvoices.orgId,
        attempts: main.expertInvoices.attempts,
        updatedAt: main.expertInvoices.updatedAt,
        error: main.expertInvoices.error,
      })
      .from(main.expertInvoices)
      .leftJoin(
        main.workflowDeadLetters,
        and(
          eq(
            main.workflowDeadLetters.workflowName,
            INVOICING_RETRY_WORKFLOW_NAME
          ),
          eq(main.workflowDeadLetters.entityId, main.expertInvoices.id),
          eq(main.workflowDeadLetters.status, "open")
        )
      )
      .where(
        and(
          eq(main.expertInvoices.status, "failed"),
          isNull(main.workflowDeadLetters.id)
        )
      )
      .orderBy(main.expertInvoices.updatedAt, main.expertInvoices.id)
      .limit(batchSize)
  })

  const result: InvoicingRetryResult = {
    scanned: candidates.length,
    retried: 0,
    skipped: 0,
    blocked: 0,
    deadLettered: 0,
    errors: 0,
  }

  for (const invoice of candidates) {
    const action = classifyFailedInvoiceForRetry({
      attempts: invoice.attempts,
      updatedAt: invoice.updatedAt,
      now,
      maxAttempts,
      minAgeMs,
    })
    try {
      switch (action) {
        case "too_recent":
          result.skipped += 1
          break
        case "dead_letter": {
          const deadLettered = await deadLetterExpertInvoice(
            invoice,
            maxAttempts
          )
          if (deadLettered) result.deadLettered += 1
          else result.skipped += 1
          break
        }
        case "retry": {
          const updated = await retryExpertInvoice({
            bookingId: invoice.bookingId,
            orgId: invoice.orgId,
            actorUserId: null,
          })
          const outcome = classifyRetryResult(updated)
          result[outcome] += 1
          break
        }
        default: {
          const _exhaustive: never = action
          throw new Error(`unhandled retry action: ${_exhaustive}`)
        }
      }
    } catch (err) {
      if (isExpertInvoiceOpError(err)) {
        result.skipped += 1
        continue
      }
      console.error("[invoicing-retry] unexpected error", invoice.id, err)
      result.errors += 1
    }
  }

  return result
}

async function deadLetterExpertInvoice(
  invoice: FailedInvoiceCandidate,
  maxAttempts: number
): Promise<boolean> {
  return withPlatformAudit(
    { orgId: invoice.orgId, actorUserId: null },
    async (tx, ctx) => {
      const [current] = await tx
        .select({
          status: main.expertInvoices.status,
          attempts: main.expertInvoices.attempts,
          error: main.expertInvoices.error,
        })
        .from(main.expertInvoices)
        .where(eq(main.expertInvoices.id, invoice.id))
        .limit(1)
        .for("update")
      if (
        !current ||
        current.status !== "failed" ||
        current.attempts < maxAttempts
      ) {
        await ctx.emit({
          entity: "invoice",
          action: "status_changed",
          entityId: invoice.id,
          payload: {
            bookingId: invoice.bookingId,
            deadLettered: false,
            skipped: true,
            status: current?.status ?? null,
            attempts: current?.attempts ?? invoice.attempts,
          },
        })
        return false
      }

      const [inserted] = await tx
        .insert(main.workflowDeadLetters)
        .values({
          orgId: invoice.orgId,
          workflowName: INVOICING_RETRY_WORKFLOW_NAME,
          entityId: invoice.id,
          payload: {
            bookingId: invoice.bookingId,
            attempts: current.attempts,
            error: current.error,
          },
          attempts: current.attempts,
          lastError: current.error,
        })
        .onConflictDoNothing()
        .returning({ id: main.workflowDeadLetters.id })
      // withAudit requires exactly one emit even when the unique index
      // skips a duplicate insert from an overlapping sweep.
      await ctx.emit({
        entity: "invoice",
        action: "status_changed",
        entityId: invoice.id,
        payload: {
          bookingId: invoice.bookingId,
          deadLettered: true,
          created: Boolean(inserted),
          attempts: current.attempts,
          error: current.error,
        },
      })
      return Boolean(inserted)
    }
  )
}
