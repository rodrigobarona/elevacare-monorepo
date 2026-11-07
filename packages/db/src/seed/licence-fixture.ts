import { and, eq } from "drizzle-orm"
import * as main from "../schema/main"

/**
 * Seed-only: record an approved licence application so a synthetic
 * fixture profile is public (public queries require one, see
 * `licenceVerified()`). The fixture expert is its own reviewer because
 * seeds have no staff user; real approvals go through the staff queue.
 */
export async function ensureFixtureLicenceApproved(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  args: { orgId: string; expertProfileId: string; reviewerUserId: string }
): Promise<void> {
  const [existing] = await client
    .select({ id: main.becomePartnerApplications.id })
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
  if (existing) return
  await client.insert(main.becomePartnerApplications).values({
    orgId: args.orgId,
    expertProfileId: args.expertProfileId,
    status: "approved",
    professionalBody: "ordem_fisioterapeutas",
    licenceNumber: "FIXTURE-0000",
    ersRegistrationNumber: "E000000",
    reviewerUserId: args.reviewerUserId,
    reviewedAt: new Date(),
    checklist: {
      register_checked: true,
      name_matches: true,
      ers_checked: true,
    },
  })
}
