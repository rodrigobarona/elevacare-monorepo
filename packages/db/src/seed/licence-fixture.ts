import { and, eq } from "drizzle-orm"
import * as main from "../schema/main"

export type FixtureLicence = {
  professionalBody: string
  licenceNumber: string
}

const PLACEHOLDER_LICENCE: FixtureLicence = {
  professionalBody: "ordem_fisioterapeutas",
  licenceNumber: "FIXTURE-0000",
}

/**
 * Seed-only: record an approved licence application so a synthetic
 * fixture profile is public (public queries require one, see
 * `licenceVerified()`). The fixture expert is its own reviewer because
 * seeds have no staff user; real approvals go through the staff queue.
 *
 * Pass `licence` when the persona stands for a real expert whose public
 * register entry was checked; the number is then also kept on the profile
 * and brought up to date on rows seeded earlier.
 */
export async function ensureFixtureLicenceApproved(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  args: {
    orgId: string
    expertProfileId: string
    reviewerUserId: string
    licence?: FixtureLicence
  }
): Promise<void> {
  const licence = args.licence ?? PLACEHOLDER_LICENCE
  const [existing] = await client
    .select({
      id: main.becomePartnerApplications.id,
      licenceNumber: main.becomePartnerApplications.licenceNumber,
      professionalBody: main.becomePartnerApplications.professionalBody,
    })
    .from(main.becomePartnerApplications)
    .where(
      and(
        eq(
          main.becomePartnerApplications.expertProfileId,
          args.expertProfileId
        ),
        eq(main.becomePartnerApplications.status, "approved")
      )
    )
    .limit(1)

  if (!existing) {
    await client.insert(main.becomePartnerApplications).values({
      orgId: args.orgId,
      expertProfileId: args.expertProfileId,
      status: "approved",
      professionalBody: licence.professionalBody,
      licenceNumber: licence.licenceNumber,
      ersRegistrationNumber: "E000000",
      reviewerUserId: args.reviewerUserId,
      reviewedAt: new Date(),
      checklist: {
        register_checked: true,
        name_matches: true,
        ers_checked: true,
      },
    })
  } else if (
    // Only a real register entry updates a row; the placeholder never
    // overwrites a number recorded earlier.
    args.licence &&
    (existing.licenceNumber !== licence.licenceNumber ||
      existing.professionalBody !== licence.professionalBody)
  ) {
    await client
      .update(main.becomePartnerApplications)
      .set({
        professionalBody: licence.professionalBody,
        licenceNumber: licence.licenceNumber,
      })
      .where(eq(main.becomePartnerApplications.id, existing.id))
  }

  if (args.licence) {
    await client
      .update(main.expertProfiles)
      .set({
        professionalBody: licence.professionalBody,
        licenceNumber: licence.licenceNumber,
      })
      .where(eq(main.expertProfiles.id, args.expertProfileId))
  }
}
