import { and, eq, inArray, sql } from "drizzle-orm"
import {
  listBillableSeatUserIds,
  main,
  withOrgContext,
  type Tx,
} from "@eleva/db"
import { organization } from "@eleva/db/schema/auth"

/**
 * How many billable seats each clinic plan includes (Phase 11, ADR-016):
 * Starter 5, Growth 20. A seat is a member with at least one published
 * service in the clinic (`listBillableSeatUserIds`).
 */
export const CLINIC_SEAT_CAPS = {
  clinic_starter: 5,
  clinic_growth: 20,
} as const

export type ClinicPlanTier = keyof typeof CLINIC_SEAT_CAPS

/** A clinic without a known plan is held to the Starter limit. */
const DEFAULT_CLINIC_TIER: ClinicPlanTier = "clinic_starter"

export function clinicPlanTier(
  tier: string | null | undefined
): ClinicPlanTier {
  return tier !== null && tier !== undefined && tier in CLINIC_SEAT_CAPS
    ? (tier as ClinicPlanTier)
    : DEFAULT_CLINIC_TIER
}

/** A subscription in one of these states is the clinic's current plan. */
const CURRENT_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
] as const

/**
 * The plan the clinic is on now: its current clinic subscription. Ended
 * subscriptions never count, and when a plan change leaves two current
 * rows for a moment the larger plan wins. No current clinic subscription
 * means Starter.
 */
async function clinicPlan(tx: Tx, orgId: string): Promise<ClinicPlanTier> {
  const rows = await tx
    .select({ tier: main.billingSubscriptions.tier })
    .from(main.billingSubscriptions)
    .where(
      and(
        eq(main.billingSubscriptions.orgId, orgId),
        inArray(main.billingSubscriptions.status, [
          ...CURRENT_SUBSCRIPTION_STATUSES,
        ]),
        inArray(main.billingSubscriptions.tier, Object.keys(CLINIC_SEAT_CAPS))
      )
    )
  return rows
    .map((row) => clinicPlanTier(row.tier))
    .reduce<ClinicPlanTier>(
      (best, plan) =>
        CLINIC_SEAT_CAPS[plan] > CLINIC_SEAT_CAPS[best] ? plan : best,
      DEFAULT_CLINIC_TIER
    )
}

/** The clinic's plan and how many seats it includes. */
export async function getClinicSeatAllowance(
  orgId: string
): Promise<{ plan: ClinicPlanTier; cap: number }> {
  const plan = await withOrgContext(orgId, (tx) => clinicPlan(tx, orgId))
  return { plan, cap: CLINIC_SEAT_CAPS[plan] }
}

/** The clinic's plan has no seat left for one more publishing member. */
export class SeatLimitReachedError extends Error {
  constructor(
    readonly cap: number,
    readonly plan: ClinicPlanTier
  ) {
    super("SEAT_LIMIT_REACHED")
    this.name = "SeatLimitReachedError"
  }
}

/**
 * Call inside the transaction that publishes a service, before the publish
 * is written. In a clinic, a member's first published service takes a seat:
 * refuse it when the plan has none left. Publishes for one clinic are taken
 * one at a time (advisory lock for the rest of the transaction), so two
 * members cannot both take the last seat. No-op outside team orgs and for
 * a member who already holds a seat.
 */
export async function assertSeatAvailable(
  tx: Tx,
  input: { orgId: string; userId: string }
): Promise<void> {
  const [org] = await tx
    .select({ type: organization.type })
    .from(organization)
    .where(eq(organization.id, input.orgId))
    .limit(1)
  if (org?.type !== "team") return

  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`team-seats:${input.orgId}`}, 0))`
  )
  const seats = await listBillableSeatUserIds(tx, input.orgId)
  if (seats.includes(input.userId)) return

  const plan = await clinicPlan(tx, input.orgId)
  const cap = CLINIC_SEAT_CAPS[plan]
  if (seats.length + 1 > cap) throw new SeatLimitReachedError(cap, plan)
}
