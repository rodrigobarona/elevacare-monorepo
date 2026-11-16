import { and, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm"
import * as main from "../schema/main"

/**
 * An expert is public (listed, profile visible, bookable) only once staff
 * approved a licence application for that profile. Profiles that were
 * `active` before the licence gate stay hidden until verified, which keeps
 * the published terms ("only experts whose registration Eleva verified
 * appear") true. Use next to `status = 'active'` in every public query.
 */
export function licenceVerified(): SQL {
  return sql`exists (
    select 1 from ${main.becomePartnerApplications}
    where ${main.becomePartnerApplications.expertProfileId} = ${main.expertProfiles.id}
      and ${main.becomePartnerApplications.status} = 'approved'
  )`
}

/** Active, licence verified and not deleted: public unless closed. */
function publicBeforeClosure(): SQL {
  return and(
    eq(main.expertProfiles.status, "active"),
    licenceVerified(),
    isNull(main.expertProfiles.deletedAt)
  )!
}

/**
 * The one rule for showing an expert anywhere public (profile, services,
 * listings, booking): active, licence verified, not deleted, and not closed
 * by the owner (ADR-026). Every public query uses this, not its parts.
 */
export function publiclyVisibleExpert(): SQL {
  return and(publicBeforeClosure(), isNull(main.expertProfiles.closedAt))!
}

/**
 * A practice that would be public but its owner closed it. Only these
 * answer "practice closed"; drafts and unverified profiles stay unknown.
 */
export function closedPublicExpert(): SQL {
  return and(publicBeforeClosure(), isNotNull(main.expertProfiles.closedAt))!
}
