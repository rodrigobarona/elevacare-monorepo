import { and, eq } from "drizzle-orm"
import * as main from "../schema/main"

export type FixtureLicence = {
  professionalBody: string
  licenceNumber: string
  /** ERS (Entidade Reguladora da Saúde) registration number. */
  ersRegistrationNumber: string
}

const PLACEHOLDER_LICENCE: FixtureLicence = {
  professionalBody: "ordem_fisioterapeutas",
  licenceNumber: "FIXTURE-0000",
  ersRegistrationNumber: "E000000",
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
      ersRegistrationNumber:
        main.becomePartnerApplications.ersRegistrationNumber,
    })
    .from(main.becomePartnerApplications)
    .where(
      and(
        eq(
          main.becomePartnerApplications.expertProfileId,
          args.expertProfileId
        ),
        eq(main.becomePartnerApplications.orgId, args.orgId),
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
      ersRegistrationNumber: licence.ersRegistrationNumber,
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
      existing.professionalBody !== licence.professionalBody ||
      existing.ersRegistrationNumber !== licence.ersRegistrationNumber)
  ) {
    await client
      .update(main.becomePartnerApplications)
      .set({
        professionalBody: licence.professionalBody,
        licenceNumber: licence.licenceNumber,
        ersRegistrationNumber: licence.ersRegistrationNumber,
      })
      .where(eq(main.becomePartnerApplications.id, existing.id))
  }

  if (args.licence) {
    await client
      .update(main.expertProfiles)
      .set({
        professionalBody: licence.professionalBody,
        licenceNumber: licence.licenceNumber,
        ersRegistrationNumber: licence.ersRegistrationNumber,
      })
      // Platform-admin context bypasses RLS: scope to the seed's own org so
      // a profile owned by another organization is never touched.
      .where(
        and(
          eq(main.expertProfiles.id, args.expertProfileId),
          eq(main.expertProfiles.orgId, args.orgId)
        )
      )
  }
}
