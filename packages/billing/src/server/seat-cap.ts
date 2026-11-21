import { desc, eq, sql } from "drizzle-orm"
import { listBillableSeatUserIds, main, type Tx } from "@eleva/db"
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

  const [subscription] = await tx
    .select({ tier: main.billingSubscriptions.tier })
    .from(main.billingSubscriptions)
    .where(eq(main.billingSubscriptions.orgId, input.orgId))
    .orderBy(desc(main.billingSubscriptions.updatedAt))
    .limit(1)
  const plan = clinicPlanTier(subscription?.tier)
  const cap = CLINIC_SEAT_CAPS[plan]
  if (seats.length + 1 > cap) throw new SeatLimitReachedError(cap, plan)
}
