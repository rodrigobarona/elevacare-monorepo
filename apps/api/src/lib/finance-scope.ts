import { isClinicClinician } from "@eleva/auth/capabilities"
import type { ElevaSession } from "@eleva/auth/types"
import { getExpertProfileForOrg } from "@eleva/db"

/**
 * How far a caller's money and tax powers reach in their active org.
 *
 * - `{}`: the whole org (an independent expert in their own practice, or a
 *   clinic admin).
 * - `{ expertProfileId }`: a clinic clinician (`isClinicClinician`), limited
 *   to bookings where they are the expert.
 * - `null`: a clinic clinician with no expert profile in this clinic, so
 *   nothing of theirs to act on. Callers answer 403.
 */
export async function resolveFinanceScope(
  session: Pick<ElevaSession, "user" | "orgId" | "orgType" | "membershipRole">
): Promise<{ expertProfileId?: string } | null> {
  if (!isClinicClinician(session)) return {}
  const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
  return profile ? { expertProfileId: profile.id } : null
}
