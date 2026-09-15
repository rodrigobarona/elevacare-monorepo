import { and, eq, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { requireToconlineEnv } from "@eleva/config/env"
import { main, withOrgContext } from "@eleva/db"
import { getFlag } from "@eleva/flags"
import { AdapterError } from "./types"
import type { IssueInvoiceInput, InvoicingProviderSlug } from "./types"
import { persistExpertIntegrationCredentials } from "./persist-credentials"
import { getAdapter } from "./registry"
import {
  ensureToconlineAccessToken,
  resolveDocumentSeriesId,
} from "./adapters/toconline"
import { TOC_V1_AUTO_FINALIZE_BLOCKED } from "./adapters/toconline/issuance-gate"

export type IssueExpertServiceInvoiceInput = {
  bookingPaymentId: string
  orgId: string
}

export type IssueExpertServiceInvoiceResult =
  | { skipped: true; reason: string }
  | {
      skipped: false
      invoiceId: string
      status: "pending" | "failed" | "manual_pending"
      error: string | null
    }

export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code: unknown }).code === "23505"
    ) {
      return true
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause: unknown }).cause
        : undefined
  }
  return false
}

export function invoiceStatusFromAdapterError(err: unknown): {
  status: "failed"
  error: string
} {
  if (err instanceof AdapterError && err.providerCode) {
    return { status: "failed", error: err.providerCode }
  }
  return {
    status: "failed",
    error: err instanceof Error ? err.message : "invoice_dispatch_failed",
  }
}

export function buildMemberInvoiceInput(input: {
  bookingId: string
  expertProfileId: string
  buyerTaxId: string | null
  guestName: string | null
  guestEmail: string | null
  memberCountry: string | null
  amountCents: number
  currency: string
  paidAt: Date | null
}): IssueInvoiceInput {
  const unitPrice = Math.max(0, input.amountCents) / 100
  const paidAt = input.paidAt ?? new Date()
  const date = paidAt.toISOString().slice(0, 10)
  const email = input.guestEmail
  return {
    bookingId: input.bookingId,
    expertProfileId: input.expertProfileId,
    member: {
      fiscalId: input.buyerTaxId ?? "",
      name: input.guestName?.trim() || "Member",
      country: input.memberCountry?.trim() || "PT",
      ...(email ? { email } : {}),
    },
    lines: [
      {
        description: "Session",
        quantity: 1,
        unitPrice,
        // Unsigned IVA: mapper refuses `exempt` without a signed legal
        // code. issueInvoice asserts the v1 auto-finalize gate first so
        // dispatch records `toconline_v1_auto_finalize_blocked`.
        taxRate: 0,
        taxTreatment: "exempt",
        currency: input.currency || "EUR",
      },
    ],
    date,
  }
}

export async function issueExpertServiceInvoice(
  input: IssueExpertServiceInvoiceInput
): Promise<IssueExpertServiceInvoiceResult> {
  const appsEnabled = await getFlag("ff.expert_invoicing_apps_enabled")
  if (!appsEnabled) {
    return { skipped: true, reason: "flag_disabled" }
  }

  const snapshot = await withOrgContext(input.orgId, async (tx) => {
    const [payment] = await tx
      .select({
        id: main.bookingPayments.id,
        status: main.bookingPayments.status,
        amountCents: main.bookingPayments.amountCents,
        paidAt: main.bookingPayments.paidAt,
        bookingId: main.bookingPayments.bookingId,
      })
      .from(main.bookingPayments)
      .where(eq(main.bookingPayments.id, input.bookingPaymentId))
      .limit(1)
    if (!payment) return null
    const [booking] = await tx
      .select({
        id: main.bookings.id,
        orgId: main.bookings.orgId,
        expertProfileId: main.bookings.expertProfileId,
        buyerTaxId: main.bookings.buyerTaxId,
        guestName: main.bookings.guestName,
        guestEmail: main.bookings.guestEmail,
        memberCountry: main.bookings.memberCountry,
        currency: main.bookings.currency,
      })
      .from(main.bookings)
      .where(eq(main.bookings.id, payment.bookingId))
      .limit(1)
    if (!booking) return null
    const [profile] = await tx
      .select({
        id: main.expertProfiles.id,
        invoicingProvider: main.expertProfiles.invoicingProvider,
        invoicingSetupStatus: main.expertProfiles.invoicingSetupStatus,
        userId: main.expertProfiles.userId,
      })
      .from(main.expertProfiles)
      .where(eq(main.expertProfiles.id, booking.expertProfileId))
      .limit(1)
    const provider = profile?.invoicingProvider ?? "manual"
    const [integration] = await tx
      .select({
        id: main.expertIntegrations.id,
        vaultRef: main.expertIntegrations.vaultRef,
        metadata: main.expertIntegrations.metadata,
        expiresAt: main.expertIntegrations.expiresAt,
      })
      .from(main.expertIntegrations)
      .where(
        and(
          eq(main.expertIntegrations.expertProfileId, booking.expertProfileId),
          eq(main.expertIntegrations.slug, provider),
          eq(main.expertIntegrations.category, "invoicing")
        )
      )
      .limit(1)
    return { payment, booking, profile, provider, integration }
  })

  if (!snapshot) {
    return { skipped: true, reason: "payment_not_found" }
  }
  if (snapshot.payment.status !== "succeeded") {
    return { skipped: true, reason: "payment_not_succeeded" }
  }
  if (!snapshot.profile) {
    return { skipped: true, reason: "expert_profile_missing" }
  }

  const provider = snapshot.provider as InvoicingProviderSlug
  if (provider === "toconline") {
    const toconlineEnabled = await getFlag("ff.invoicing.toconline")
    if (!toconlineEnabled) {
      return { skipped: true, reason: "flag_disabled" }
    }
  }

  const existing = await withOrgContext(input.orgId, async (tx) => {
    const [row] = await tx
      .select({
        id: main.expertInvoices.id,
        status: main.expertInvoices.status,
        error: main.expertInvoices.error,
      })
      .from(main.expertInvoices)
      .where(
        and(
          eq(main.expertInvoices.bookingId, snapshot.booking.id),
          eq(main.expertInvoices.expertOrgId, input.orgId)
        )
      )
      .limit(1)
    return row ?? null
  })

  if (existing && existing.status !== "pending") {
    return existing.status === "manual_pending"
      ? {
          skipped: false,
          invoiceId: existing.id,
          status: "manual_pending",
          error: existing.error,
        }
      : { skipped: true, reason: "already_dispatched" }
  }

  const inserted = existing
    ? existing
    : await insertInvoice({
        orgId: input.orgId,
        bookingId: snapshot.booking.id,
        provider,
        amountCents: snapshot.payment.amountCents,
        memberNif: snapshot.booking.buyerTaxId,
      })

  if (inserted.status !== "pending") {
    return inserted.status === "manual_pending"
      ? {
          skipped: false,
          invoiceId: inserted.id,
          status: "manual_pending",
          error: inserted.error,
        }
      : { skipped: true, reason: "already_dispatched" }
  }

  if (provider === "toconline" && !snapshot.integration?.vaultRef) {
    return failInvoice({
      orgId: input.orgId,
      invoiceId: inserted.id,
      bookingId: snapshot.booking.id,
      provider,
      error: "credentials",
    })
  }

  const adapter = getAdapter(provider)
  let vaultRef = snapshot.integration?.vaultRef ?? ""
  let metadata: Record<string, unknown> = {
    ...((snapshot.integration?.metadata ?? {}) as Record<string, unknown>),
    orgId: input.orgId,
    userId: snapshot.profile.userId,
  }

  try {
    if (provider === "toconline" && vaultRef) {
      const loaded = await ensureToconlineAccessToken(
        vaultRef,
        input.orgId,
        snapshot.profile.userId
      )
      if (loaded.rotated || !metadata.document_series_id) {
        if (!metadata.document_series_id) {
          try {
            const env = requireToconlineEnv()
            const seriesId = await resolveDocumentSeriesId(
              {
                apiBase: env.TOCONLINE_API_URL.replace(/\/$/, ""),
                accessToken: loaded.accessToken,
              },
              { documentType: "FT", prefix: env.TOCONLINE_SERIES_PREFIX }
            )
            if (seriesId) {
              metadata = { ...metadata, document_series_id: seriesId }
            }
          } catch (err) {
            console.warn(
              "[toconline] document series lookup failed during dispatch",
              err instanceof Error ? err.message : err
            )
          }
        }
        vaultRef = loaded.vaultRef
        await persistExpertIntegrationCredentials({
          orgId: input.orgId,
          integrationId: snapshot.integration!.id,
          vaultRef: loaded.vaultRef,
          expiresAt: loaded.expiresAt,
          metadata,
          rotated: loaded.rotated,
        })
      }
    }

    const issueInput = buildMemberInvoiceInput({
      bookingId: snapshot.booking.id,
      expertProfileId: snapshot.profile.id,
      buyerTaxId: snapshot.booking.buyerTaxId,
      guestName: snapshot.booking.guestName,
      guestEmail: snapshot.booking.guestEmail,
      memberCountry: snapshot.booking.memberCountry,
      amountCents: snapshot.payment.amountCents,
      currency: snapshot.booking.currency,
      paidAt: snapshot.payment.paidAt,
    })

    await adapter.issueInvoice(
      { vaultRef, metadata, orgId: input.orgId },
      issueInput
    )
    return {
      skipped: false,
      invoiceId: inserted.id,
      status: "pending",
      error: null,
    }
  } catch (err) {
    const mapped = invoiceStatusFromAdapterError(err)
    return failInvoice({
      orgId: input.orgId,
      invoiceId: inserted.id,
      bookingId: snapshot.booking.id,
      provider,
      error: mapped.error,
    })
  }
}

async function insertInvoice(input: {
  orgId: string
  bookingId: string
  provider: InvoicingProviderSlug
  amountCents: number
  memberNif: string | null
}): Promise<{
  id: string
  status: (typeof main.expertInvoices.$inferSelect)["status"]
  error: string | null
}> {
  try {
    return await withAudit(
      { orgId: input.orgId, actorUserId: null },
      async (tx, ctx) => {
        const [row] = await tx
          .insert(main.expertInvoices)
          .values({
            orgId: input.orgId,
            bookingId: input.bookingId,
            expertOrgId: input.orgId,
            adapter: input.provider,
            amountCents: input.amountCents,
            memberNif: input.memberNif,
            status: input.provider === "manual" ? "manual_pending" : "pending",
          })
          .returning({
            id: main.expertInvoices.id,
            status: main.expertInvoices.status,
            error: main.expertInvoices.error,
          })
        await ctx.emit({
          entity: "invoice",
          action: "created",
          entityId: row!.id,
          payload: {
            bookingId: input.bookingId,
            adapter: input.provider,
            status: row!.status,
          },
        })
        return row!
      }
    )
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const duplicate = await withOrgContext(input.orgId, async (tx) => {
      const [row] = await tx
        .select({
          id: main.expertInvoices.id,
          status: main.expertInvoices.status,
          error: main.expertInvoices.error,
        })
        .from(main.expertInvoices)
        .where(
          and(
            eq(main.expertInvoices.bookingId, input.bookingId),
            eq(main.expertInvoices.expertOrgId, input.orgId)
          )
        )
        .limit(1)
      return row ?? null
    })
    if (!duplicate) throw err
    return duplicate
  }
}

async function failInvoice(input: {
  orgId: string
  invoiceId: string
  bookingId: string
  provider: InvoicingProviderSlug
  error: string
}): Promise<Extract<IssueExpertServiceInvoiceResult, { skipped: false }>> {
  const updated = await withAudit(
    { orgId: input.orgId, actorUserId: null },
    async (tx, ctx) => {
      const [row] = await tx
        .update(main.expertInvoices)
        .set({
          status: "failed",
          error: input.error,
          attempts: sql`${main.expertInvoices.attempts} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(main.expertInvoices.id, input.invoiceId))
        .returning({
          id: main.expertInvoices.id,
          status: main.expertInvoices.status,
          error: main.expertInvoices.error,
        })
      await ctx.emit({
        entity: "invoice",
        action: "failed",
        entityId: input.invoiceId,
        payload: {
          bookingId: input.bookingId,
          adapter: input.provider,
          error: input.error,
          blocked: input.error === TOC_V1_AUTO_FINALIZE_BLOCKED,
        },
      })
      return row!
    }
  )
  return {
    skipped: false,
    invoiceId: updated.id,
    status: "failed",
    error: updated.error,
  }
}
