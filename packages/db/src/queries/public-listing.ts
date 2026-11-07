import { sql, type SQL } from "drizzle-orm"
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
