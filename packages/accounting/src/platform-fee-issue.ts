/**
 * Closed-gate Tier 1 orchestration (07.1).
 *
 * `issuePlatformFeeInvoice` classifies IVA conservatively, may GET tax
 * lookups, and records `blocked` / `skipped` on `platform_fee_invoices`.
 * It never POSTs `/api/v1/commercial_sales_documents`. Credit notes are
 * originated only when commission is reduced (Manolo 2026-09-15).
 * A successful persist emits `invoice.blocked` / `invoice.skipped` /
 * `invoice.pending` on the domain-events outbox for Phase 8.
 */

import { and, eq } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import { getFlag } from "@eleva/flags"
import type { ResolvedIvaLookups } from "./adapters/toconline/iva-lookups"
import {
  TOC_V1_AUTO_FINALIZE_BLOCKED,
  assertV1SalesDocumentPostAllowed,
} from "./adapters/toconline/issuance-gate"
import { classifyIvaRegime, type IvaDecision } from "./core/iva-matrix"
import { invoiceStatusFromAdapterError, isUniqueViolation } from "./dispatch"
import {
  emitClosedGateInvoiceDomainEvent,
  type ClosedGateInvoiceEventRef,
} from "./platform-fee-events"
import {
  toPublicPlatformFeeInvoice,
  type PlatformFeeInvoiceStatus,
  type PlatformFeeIvaRegime,
  type PublicPlatformFeeInvoice,
} from "./platform-fee-invoices"

export const D09_PLATFORM_FEE_STATUSES = [
  "legacy",
  "legacy_missing",
] as const satisfies readonly PlatformFeeInvoiceStatus[]

export type PlatformFeeIssuanceOutcome =
  | "skipped"
  | "blocked"
  | "pending"
  | "already_recorded"

export type IssuePlatformFeeInvoiceResult = {
  invoice: PublicPlatformFeeInvoice | null
  outcome: PlatformFeeIssuanceOutcome
  reason: string | null
  domainEvent: ClosedGateInvoiceEventRef | null
}

export type IssuePlatformFeeCreditNoteResult =
  | { skipped: true; reason: string }
  | {
      skipped: false
      creditNoteId: string
      status: "blocked"
      reason: "commission_reduction"
    }

export type PlatformFeeIvaLookup = (
  decision: IvaDecision
) => Promise<ResolvedIvaLookups>

const invoiceSelect = {
  id: main.platformFeeInvoices.id,
  bookingPaymentId: main.platformFeeInvoices.bookingPaymentId,
  expertOrgId: main.platformFeeInvoices.expertOrgId,
  status: main.platformFeeInvoices.status,
  ivaRegime: main.platformFeeInvoices.ivaRegime,
  amountCents: main.platformFeeInvoices.amountCents,
  ivaRateBps: main.platformFeeInvoices.ivaRateBps,
  series: main.platformFeeInvoices.series,
  number: main.platformFeeInvoices.number,
  atStatus: main.platformFeeInvoices.atStatus,
  issuedAt: main.platformFeeInvoices.issuedAt,
  error: main.platformFeeInvoices.error,
  attempts: main.platformFeeInvoices.attempts,
}

export function isD09PlatformFeeStatus(
  status: PlatformFeeInvoiceStatus
): boolean {
  switch (status) {
    case "legacy":
    case "legacy_missing":
      return true
    case "pending":
    case "issued":
    case "failed":
    case "blocked":
    case "skipped":
    case "dead_lettered":
    case "credited":
      return false
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function isTerminalPlatformFeeStatus(
  status: PlatformFeeInvoiceStatus
): boolean {
  switch (status) {
    case "pending":
      return false
    case "issued":
    case "failed":
    case "blocked":
    case "skipped":
    case "dead_lettered":
    case "credited":
    case "legacy":
    case "legacy_missing":
      return true
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function shouldIssuePlatformFeeCreditNote(
  commissionReductionCents: number
): boolean {
  return (
    Number.isFinite(commissionReductionCents) && commissionReductionCents > 0
  )
}

export function elevaFeeSeries(at: Date): string {
  const year = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
  }).format(at)
  return `ELEVA-FEE-${year}`
}

export function ivaRateBpsFromLookups(lookups: ResolvedIvaLookups): number {
  if (!lookups.ok || lookups.tax.taxPercentage === null) return 0
  return Math.round(lookups.tax.taxPercentage * 100)
}

export function decidePlatformFeeRecord(input: {
  iva: IvaDecision
  lookups: ResolvedIvaLookups | null
  amountCents: number
}): {
  status: Extract<PlatformFeeInvoiceStatus, "blocked" | "skipped" | "pending">
  error: string
  ivaRegime: PlatformFeeIvaRegime
  ivaRateBps: number
} {
  const ivaRegime = input.iva.regime
  if (input.amountCents <= 0) {
    return {
      status: "skipped",
      error: "zero_fee",
      ivaRegime,
      ivaRateBps: 0,
    }
  }
  if (!input.iva.canIssue) {
    return {
      status: "skipped",
      error: input.iva.queueReason ?? "iva_regime_queued",
      ivaRegime,
      ivaRateBps: 0,
    }
  }
  if (!input.lookups) {
    return {
      status: "pending",
      error: "iva_lookup_unavailable",
      ivaRegime,
      ivaRateBps: 0,
    }
  }
  if (!input.lookups.ok) {
    return {
      status: "pending",
      error: input.lookups.reason,
      ivaRegime,
      ivaRateBps: 0,
    }
  }
  return {
    status: "blocked",
    error: TOC_V1_AUTO_FINALIZE_BLOCKED,
    ivaRegime,
    ivaRateBps: ivaRateBpsFromLookups(input.lookups),
  }
}

export async function issuePlatformFeeInvoice(input: {
  bookingPaymentId: string
  lookupIva?: PlatformFeeIvaLookup
}): Promise<IssuePlatformFeeInvoiceResult> {
  const enabled = await getFlag("ff.toconline_invoicing_enabled")
  if (!enabled) {
    return {
      invoice: null,
      outcome: "skipped",
      reason: "flag_disabled",
      domainEvent: null,
    }
  }

  const snapshot = await loadIssuanceSnapshot(input.bookingPaymentId)
  if (!snapshot) {
    return {
      invoice: null,
      outcome: "skipped",
      reason: "payment_not_found",
      domainEvent: null,
    }
  }
  if (snapshot.payment.status !== "succeeded") {
    return {
      invoice: null,
      outcome: "skipped",
      reason: "payment_not_succeeded",
      domainEvent: null,
    }
  }
  if (!snapshot.payment.paidAt) {
    return {
      invoice: null,
      outcome: "skipped",
      reason: "payment_paid_at_missing",
      domainEvent: null,
    }
  }
  if (
    snapshot.existing &&
    isTerminalPlatformFeeStatus(snapshot.existing.status)
  ) {
    return {
      invoice: toPublicPlatformFeeInvoice(snapshot.existing),
      outcome: "already_recorded",
      reason: isD09PlatformFeeStatus(snapshot.existing.status)
        ? "d09_legacy"
        : snapshot.existing.error,
      domainEvent: null,
    }
  }
  if (!snapshot.profile) {
    return {
      invoice: null,
      outcome: "skipped",
      reason: "expert_profile_missing",
      domainEvent: null,
    }
  }

  const iva = classifyIvaRegime({
    countryIso: snapshot.profile.practiceCountry,
    vatNumber: snapshot.profile.nif,
    reverseChargeLegalReqsMet: false,
  })

  let lookups: ResolvedIvaLookups | null = null
  if (iva.canIssue && snapshot.payment.applicationFeeCents > 0) {
    lookups = input.lookupIva
      ? await input.lookupIva(iva)
      : {
          ok: false,
          regime: iva.regime,
          reason: "iva_lookup_unavailable",
        }
  }

  const decision = decidePlatformFeeRecord({
    iva,
    lookups,
    amountCents: snapshot.payment.applicationFeeCents,
  })

  if (decision.status === "blocked") {
    try {
      assertV1SalesDocumentPostAllowed()
    } catch (err) {
      const mapped = invoiceStatusFromAdapterError(err)
      decision.error = mapped.error
    }
  }

  const series = elevaFeeSeries(snapshot.payment.paidAt)
  const persisted = await persistPlatformFeeInvoice({
    orgId: snapshot.payment.orgId,
    bookingPaymentId: snapshot.payment.id,
    expertOrgId: snapshot.payment.orgId,
    amountCents: snapshot.payment.applicationFeeCents,
    series,
    existingId: snapshot.existing?.id ?? null,
    decision,
  })

  return {
    invoice: persisted.invoice,
    outcome: decision.status,
    reason: decision.error,
    domainEvent: persisted.domainEvent,
  }
}

export async function issuePlatformFeeCreditNote(input: {
  bookingPaymentId: string
  bookingRefundId: string
  commissionReductionCents: number
}): Promise<IssuePlatformFeeCreditNoteResult> {
  if (!shouldIssuePlatformFeeCreditNote(input.commissionReductionCents)) {
    return { skipped: true, reason: "no_commission_reduction" }
  }

  const snapshot = await withPlatformAdminContext(async (tx) => {
    const [invoice] = await tx
      .select({
        id: main.platformFeeInvoices.id,
        orgId: main.platformFeeInvoices.orgId,
        status: main.platformFeeInvoices.status,
      })
      .from(main.platformFeeInvoices)
      .where(
        eq(main.platformFeeInvoices.bookingPaymentId, input.bookingPaymentId)
      )
      .limit(1)
    if (!invoice) return null
    const [existing] = await tx
      .select({
        id: main.platformFeeCreditNotes.id,
        status: main.platformFeeCreditNotes.status,
      })
      .from(main.platformFeeCreditNotes)
      .where(
        eq(main.platformFeeCreditNotes.bookingRefundId, input.bookingRefundId)
      )
      .limit(1)
    return { invoice, existing: existing ?? null }
  })

  if (!snapshot) {
    return { skipped: true, reason: "invoice_missing" }
  }
  if (isD09PlatformFeeStatus(snapshot.invoice.status)) {
    return { skipped: true, reason: "d09_legacy" }
  }
  if (snapshot.existing) {
    return snapshot.existing.status === "blocked"
      ? {
          skipped: false,
          creditNoteId: snapshot.existing.id,
          status: "blocked",
          reason: "commission_reduction",
        }
      : { skipped: true, reason: "already_recorded" }
  }

  try {
    assertV1SalesDocumentPostAllowed()
  } catch {
    // Closed gate: persist blocked NC intent, never POST.
  }

  try {
    const inserted = await withAudit(
      { orgId: snapshot.invoice.orgId, actorUserId: null },
      async (tx, ctx) => {
        const [row] = await tx
          .insert(main.platformFeeCreditNotes)
          .values({
            orgId: snapshot.invoice.orgId,
            platformFeeInvoiceId: snapshot.invoice.id,
            bookingRefundId: input.bookingRefundId,
            reason: "commission_reduction",
            amountCents: input.commissionReductionCents,
            status: "blocked",
            error: TOC_V1_AUTO_FINALIZE_BLOCKED,
          })
          .returning({ id: main.platformFeeCreditNotes.id })
        await ctx.emit({
          entity: "invoice",
          action: "credited",
          entityId: snapshot.invoice.id,
          payload: {
            bookingPaymentId: input.bookingPaymentId,
            bookingRefundId: input.bookingRefundId,
            creditNoteId: row!.id,
            amountCents: input.commissionReductionCents,
            status: "blocked",
            posted: false,
          },
        })
        return row!
      }
    )
    return {
      skipped: false,
      creditNoteId: inserted.id,
      status: "blocked",
      reason: "commission_reduction",
    }
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    return { skipped: true, reason: "already_recorded" }
  }
}

class PlatformFeeInvoiceAlreadyRecordedError extends Error {
  constructor() {
    super("platform_fee_invoice_already_recorded")
    this.name = "PlatformFeeInvoiceAlreadyRecordedError"
  }
}

async function persistPlatformFeeInvoice(input: {
  orgId: string
  bookingPaymentId: string
  expertOrgId: string
  amountCents: number
  series: string
  existingId: string | null
  decision: {
    status: Extract<PlatformFeeInvoiceStatus, "blocked" | "skipped" | "pending">
    error: string
    ivaRegime: PlatformFeeIvaRegime
    ivaRateBps: number
  }
}): Promise<{
  invoice: PublicPlatformFeeInvoice
  domainEvent: ClosedGateInvoiceEventRef | null
}> {
  try {
    return await withAudit(
      { orgId: input.orgId, actorUserId: null },
      async (tx, ctx) => {
        let row: PublicPlatformFeeInvoice | null = null
        if (!input.existingId) {
          const [inserted] = await tx
            .insert(main.platformFeeInvoices)
            .values({
              orgId: input.orgId,
              bookingPaymentId: input.bookingPaymentId,
              expertOrgId: input.expertOrgId,
              amountCents: input.amountCents,
              ivaRateBps: input.decision.ivaRateBps,
              ivaRegime: input.decision.ivaRegime,
              status: input.decision.status,
              series: input.series,
              atStatus: "operator_gated",
              error: input.decision.error,
            })
            .onConflictDoNothing({
              target: main.platformFeeInvoices.bookingPaymentId,
            })
            .returning(invoiceSelect)
          if (inserted) row = toPublicPlatformFeeInvoice(inserted)
        }
        if (!row) {
          const [updated] = await tx
            .update(main.platformFeeInvoices)
            .set({
              status: input.decision.status,
              ivaRegime: input.decision.ivaRegime,
              ivaRateBps: input.decision.ivaRateBps,
              series: input.series,
              error: input.decision.error,
              atStatus: "operator_gated",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(
                  main.platformFeeInvoices.bookingPaymentId,
                  input.bookingPaymentId
                ),
                eq(main.platformFeeInvoices.orgId, input.orgId),
                eq(main.platformFeeInvoices.status, "pending")
              )
            )
            .returning(invoiceSelect)
          if (updated) row = toPublicPlatformFeeInvoice(updated)
        }
        if (!row) {
          throw new PlatformFeeInvoiceAlreadyRecordedError()
        }
        const domainEvent = await emitClosedGateInvoiceDomainEvent(tx, {
          orgId: input.orgId,
          invoiceId: row.id,
          bookingPaymentId: input.bookingPaymentId,
          expertOrgId: row.expertOrgId,
          status: input.decision.status,
          error: row.error,
        })
        await ctx.emit({
          entity: "invoice",
          action: "status_changed",
          entityId: row.id,
          payload: {
            bookingPaymentId: input.bookingPaymentId,
            to: row.status,
            ivaRegime: row.ivaRegime,
            error: row.error,
            posted: false,
            domainEventType: domainEvent.type,
          },
        })
        return { invoice: row, domainEvent }
      }
    )
  } catch (err) {
    if (
      !isUniqueViolation(err) &&
      !(err instanceof PlatformFeeInvoiceAlreadyRecordedError)
    ) {
      throw err
    }
    const existing = await loadIssuanceSnapshot(input.bookingPaymentId)
    if (existing?.existing) {
      return {
        invoice: toPublicPlatformFeeInvoice(existing.existing),
        domainEvent: null,
      }
    }
    throw err
  }
}

async function loadIssuanceSnapshot(bookingPaymentId: string) {
  return withPlatformAdminContext(async (tx) => {
    const [payment] = await tx
      .select({
        id: main.bookingPayments.id,
        orgId: main.bookingPayments.orgId,
        status: main.bookingPayments.status,
        applicationFeeCents: main.bookingPayments.applicationFeeCents,
        paidAt: main.bookingPayments.paidAt,
        bookingId: main.bookingPayments.bookingId,
      })
      .from(main.bookingPayments)
      .where(eq(main.bookingPayments.id, bookingPaymentId))
      .limit(1)
    if (!payment) return null
    const [booking] = await tx
      .select({
        expertProfileId: main.bookings.expertProfileId,
      })
      .from(main.bookings)
      .where(eq(main.bookings.id, payment.bookingId))
      .limit(1)
    const [profile] = booking
      ? await tx
          .select({
            practiceCountry: main.expertProfiles.practiceCountry,
            nif: main.expertProfiles.nif,
          })
          .from(main.expertProfiles)
          .where(eq(main.expertProfiles.id, booking.expertProfileId))
          .limit(1)
      : [undefined]
    const [existing] = await tx
      .select(invoiceSelect)
      .from(main.platformFeeInvoices)
      .where(eq(main.platformFeeInvoices.bookingPaymentId, bookingPaymentId))
      .limit(1)
    return {
      payment,
      profile: profile ?? null,
      existing: existing ?? null,
    }
  })
}
