import { and, eq, isNull } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withOrgContext, withPlatformAdminContext } from "@eleva/db"
import { stripe } from "./client"
import { persistConnectStatus, snapshotFromAccount } from "./connect-status"
import type { CreateConnectAccountInput } from "./types"

/**
 * Capabilities requested at Connect account creation (D-05).
 *
 * PT Custom is transfers-only (`card_payments` absent) — proven in 06.0.
 * Express hosted-onboarding capability state is unproven, so Express
 * keeps `card_payments` + `transfers`. Do not strip `card_payments` from
 * Express on the strength of the spike.
 */
export function requestedConnectCapabilities(input: {
  country: string
  controllerDashboard: "express" | "custom"
}): {
  card_payments?: { requested: true }
  transfers: { requested: true }
} {
  const country = input.country.toUpperCase()
  if (input.controllerDashboard === "custom" && country === "PT") {
    return { transfers: { requested: true } }
  }
  return {
    card_payments: { requested: true },
    transfers: { requested: true },
  }
}

/**
 * Create a Stripe Connect Express account for an expert.
 *
 * Per ADR-005 / payments-payouts-spec.md:
 * - Solo experts: Express controller, country from expert profile (PT first)
 * - `business_type` individual | company
 * - Eleva metadata fields are stamped so webhook handlers can
 *   resolve back to the Eleva expert/org without an extra DB lookup.
 *
 * Idempotency: callers should pass an idempotency key derived from
 * the expert profile ID so retries do not create duplicate accounts.
 *
 * Launch accounts are always Express (`controller.stripe_dashboard.type:
 * express`). `requestedConnectCapabilities` still encodes D-05 for PT
 * Custom (transfers-only) so tests and a later Custom path stay aligned;
 * `createConnectAccount` does not switch launch accounts to Custom.
 *
 * Stripe is called outside any DB transaction. Persist via
 * {@link provisionConnectAccount}.
 */
export async function createConnectAccount(
  input: CreateConnectAccountInput,
  options: { idempotencyKey?: string } = {}
): Promise<{ id: string; detailsSubmitted: boolean; payoutsEnabled: boolean }> {
  const country = (input.country ?? "PT").toUpperCase()
  const account = await stripe().accounts.create(
    {
      controller: {
        stripe_dashboard: { type: "express" },
        fees: { payer: "application" },
        losses: { payments: "application" },
      },
      country,
      email: input.email,
      default_currency: input.defaultCurrency ?? "eur",
      capabilities: requestedConnectCapabilities({
        country,
        controllerDashboard: "express",
      }),
      business_type: input.businessType ?? "individual",
      metadata: {
        eleva_expert_profile_id: input.expertProfileId,
        eleva_org_id: input.orgId,
      },
    },
    options.idempotencyKey
      ? { idempotencyKey: options.idempotencyKey }
      : undefined
  )

  return {
    id: account.id,
    detailsSubmitted: account.details_submitted ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
  }
}

export type ProvisionConnectAccountInput = CreateConnectAccountInput & {
  actorUserId: string
}

export type ProvisionConnectAccountResult = {
  stripeAccountId: string
  created: boolean
  detailsSubmitted: boolean
  payoutsEnabled: boolean
}

/**
 * Read Connect onboarding status from `billing_customers` for the Payments
 * step and the publish gate.
 */
export async function getConnectOnboardingState(orgId: string): Promise<{
  stripeConnectAccountId: string | null
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirementsCurrentlyDue: string[]
  connectCapabilities: {
    transfers?: string
    card_payments?: string
  }
  identityStatus: string | null
} | null> {
  return withOrgContext(orgId, async (tx) => {
    const rows = await tx
      .select({
        stripeConnectAccountId: main.billingCustomers.stripeConnectAccountId,
        payoutsEnabled: main.billingCustomers.payoutsEnabled,
        detailsSubmitted: main.billingCustomers.detailsSubmitted,
        requirementsCurrentlyDue:
          main.billingCustomers.requirementsCurrentlyDue,
        connectCapabilities: main.billingCustomers.connectCapabilities,
        identityStatus: main.billingCustomers.identityStatus,
      })
      .from(main.billingCustomers)
      .where(eq(main.billingCustomers.orgId, orgId))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return {
      stripeConnectAccountId: row.stripeConnectAccountId ?? null,
      payoutsEnabled: row.payoutsEnabled,
      detailsSubmitted: row.detailsSubmitted,
      requirementsCurrentlyDue: row.requirementsCurrentlyDue ?? [],
      connectCapabilities: row.connectCapabilities ?? {},
      identityStatus: row.identityStatus ?? null,
    }
  })
}

/**
 * Provision (or reuse) a Connect Express account. Stripe create runs
 * outside the DB transaction; persistence is wrapped in `withAudit`.
 */
export async function provisionConnectAccount(
  input: ProvisionConnectAccountInput
): Promise<ProvisionConnectAccountResult> {
  const existing = await withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({ stripeAccountId: main.expertProfiles.stripeAccountId })
      .from(main.expertProfiles)
      .where(
        and(
          eq(main.expertProfiles.id, input.expertProfileId),
          eq(main.expertProfiles.orgId, input.orgId)
        )
      )
      .limit(1)
    return rows[0]
  })

  if (!existing) {
    throw new Error("expert_profile_not_found")
  }

  if (existing.stripeAccountId) {
    const retrieved = await stripe().accounts.retrieve(existing.stripeAccountId)
    await withAudit(
      { orgId: input.orgId, actorUserId: input.actorUserId },
      async (tx, ctx) => {
        await persistConnectStatus(
          tx,
          input.orgId,
          snapshotFromAccount(retrieved)
        )
        await ctx.emit({
          entity: "connect_account",
          action: "synced",
          entityId: existing.stripeAccountId,
          payload: { stripeAccountId: existing.stripeAccountId },
        })
      }
    )
    return {
      stripeAccountId: existing.stripeAccountId,
      created: false,
      detailsSubmitted: retrieved.details_submitted ?? false,
      payoutsEnabled: retrieved.payouts_enabled ?? false,
    }
  }

  const account = await createConnectAccount(input, {
    idempotencyKey: `connect:${input.expertProfileId}`,
  })

  const retrieved = await stripe().accounts.retrieve(account.id)

  let created = true
  let stripeAccountId = account.id
  let detailsSubmitted = account.detailsSubmitted
  let payoutsEnabled = account.payoutsEnabled

  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const claimed = await tx
        .update(main.expertProfiles)
        .set({
          stripeAccountId: account.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(main.expertProfiles.id, input.expertProfileId),
            eq(main.expertProfiles.orgId, input.orgId),
            isNull(main.expertProfiles.stripeAccountId)
          )
        )
        .returning({ id: main.expertProfiles.id })

      if (claimed.length === 0) {
        const [row] = await tx
          .select({ stripeAccountId: main.expertProfiles.stripeAccountId })
          .from(main.expertProfiles)
          .where(
            and(
              eq(main.expertProfiles.id, input.expertProfileId),
              eq(main.expertProfiles.orgId, input.orgId)
            )
          )
          .limit(1)
        const stored = row?.stripeAccountId
        if (!stored) {
          throw new Error("connect_account_claim_failed")
        }
        created = false
        stripeAccountId = stored
        if (stored === account.id) {
          detailsSubmitted = retrieved.details_submitted ?? false
          payoutsEnabled = retrieved.payouts_enabled ?? false
          await persistConnectStatus(
            tx,
            input.orgId,
            snapshotFromAccount(retrieved)
          )
          await ctx.emit({
            entity: "connect_account",
            action: "synced",
            entityId: stored,
            payload: { stripeAccountId: stored },
          })
        } else {
          await ctx.emit({
            entity: "connect_account",
            action: "rejected",
            entityId: account.id,
            payload: {
              stripeAccountId: stored,
              discardedStripeAccountId: account.id,
            },
          })
        }
        return
      }

      await persistConnectStatus(
        tx,
        input.orgId,
        snapshotFromAccount(retrieved)
      )
      await ctx.emit({
        entity: "connect_account",
        action: "created",
        entityId: account.id,
        payload: {
          stripeAccountId: account.id,
          expertProfileId: input.expertProfileId,
          country: input.country ?? "PT",
        },
      })
    }
  )

  if (!created && stripeAccountId !== account.id) {
    const winner = await stripe().accounts.retrieve(stripeAccountId)
    detailsSubmitted = winner.details_submitted ?? false
    payoutsEnabled = winner.payouts_enabled ?? false
    await withAudit(
      { orgId: input.orgId, actorUserId: input.actorUserId },
      async (tx, ctx) => {
        await persistConnectStatus(tx, input.orgId, snapshotFromAccount(winner))
        await ctx.emit({
          entity: "connect_account",
          action: "synced",
          entityId: stripeAccountId,
          payload: { stripeAccountId },
        })
      }
    )
  }

  return {
    stripeAccountId,
    created,
    detailsSubmitted,
    payoutsEnabled,
  }
}
