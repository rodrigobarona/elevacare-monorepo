import { and, eq, isNull } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import { member } from "../schema/auth/index"
import { eventTypes, expertProfiles } from "../schema/main/index"

/**
 * The single seat rule: a billable seat is a member of a team org who has
 * at least one published and active event type in that same org. Runs in
 * the caller's transaction, so a publish can count and decide atomically.
 */
export async function listBillableSeatUserIds(
  tx: Tx,
  orgId: string
): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ userId: expertProfiles.userId })
    .from(expertProfiles)
    .innerJoin(eventTypes, eq(eventTypes.expertProfileId, expertProfiles.id))
    .innerJoin(
      member,
      and(
        eq(member.userId, expertProfiles.userId),
        eq(member.organizationId, orgId)
      )
    )
    .where(
      and(
        eq(expertProfiles.orgId, orgId),
        eq(eventTypes.orgId, orgId),
        eq(eventTypes.published, true),
        eq(eventTypes.active, true),
        isNull(eventTypes.deletedAt)
      )
    )
  return rows.map((row) => row.userId)
}

/**
 * Distinct auth members in a team org who have at least one published
 * and active event type in that same org.
 */
export async function countBillableSeats(orgId: string): Promise<number> {
  return withOrgContext(orgId, async (tx: Tx) => {
    return (await listBillableSeatUserIds(tx, orgId)).length
  })
}
