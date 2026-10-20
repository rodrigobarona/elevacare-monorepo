import { getExpertMember, getExpertProfileForOrg } from "@eleva/db"
import type { CrmContactRow } from "@eleva/db/schema"
import { CrmError } from "./errors"

/** CRM is per expert profile: the caller must be an expert in this org. */
export async function requireCrmExpert(
  orgId: string,
  actorUserId: string
): Promise<string> {
  const profile = await getExpertProfileForOrg(actorUserId, orgId)
  if (!profile) throw new CrmError("FORBIDDEN")
  return profile.id
}

/**
 * Members are visible to the expert they booked; leads to their author.
 * Returns the member's display name (from bookings) or null for a lead.
 */
export async function assertContactVisible(
  contact: Pick<CrmContactRow, "orgId" | "memberUserId" | "createdBy">,
  expertProfileId: string,
  actorUserId: string
): Promise<string | null> {
  if (contact.memberUserId) {
    const member = await getExpertMember(
      contact.orgId,
      expertProfileId,
      contact.memberUserId
    )
    if (!member) throw new CrmError("NOT_FOUND")
    return member.name
  }
  if (contact.createdBy !== actorUserId) throw new CrmError("NOT_FOUND")
  return null
}
