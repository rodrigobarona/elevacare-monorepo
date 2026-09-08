import { and, eq, isNull } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import { member } from "../schema/auth/index"
import { eventTypes, expertProfiles } from "../schema/main/index"

/**
 * Distinct auth members in a team org who have at least one published
 * and active event type in that same org.
 */
export async function countBillableSeats(orgId: string): Promise<number> {
  return withOrgContext(orgId, async (tx: Tx) => {
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
    return rows.length
  })
}
