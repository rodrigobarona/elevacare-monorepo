import { and, desc, eq, inArray } from "drizzle-orm"

import { withOrgContext, type Tx } from "../context"
import * as main from "../schema/main"

export interface PartnerApplicationLicence {
  professionalBody: string
  licenceNumber: string
  ersRegistrationNumber: string
}

/** Latest licence application for a profile (any status), newest first. */
export async function getLatestPartnerApplication(
  orgId: string,
  expertProfileId: string
): Promise<main.BecomePartnerApplication | null> {
  return withOrgContext(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(main.becomePartnerApplications)
      .where(
        and(
          eq(main.becomePartnerApplications.orgId, orgId),
          eq(main.becomePartnerApplications.expertProfileId, expertProfileId)
        )
      )
      .orderBy(desc(main.becomePartnerApplications.submittedAt))
      .limit(1)
    return rows[0] ?? null
  })
}

/**
 * File the licence for staff review. An open application (pending or
 * needs_changes) is refreshed in place back to `pending` with the new
 * licence snapshot; otherwise a new `pending` row is inserted. Locks the
 * expert profile row. Internal — call only inside an audited transaction.
 */
export async function _submitPartnerApplication(
  tx: Tx,
  input: {
    orgId: string
    expertProfileId: string
    licence: PartnerApplicationLicence
  }
): Promise<{ application: main.BecomePartnerApplication; refreshed: boolean }> {
  const t = main.becomePartnerApplications
  // Serialise submissions per profile, including the first one (no open row
  // to lock yet), so concurrent calls never race the open-application index.
  await tx
    .select({ id: main.expertProfiles.id })
    .from(main.expertProfiles)
    .where(eq(main.expertProfiles.id, input.expertProfileId))
    .limit(1)
    .for("update")
  const [open] = await tx
    .select({ id: t.id })
    .from(t)
    .where(
      and(
        eq(t.expertProfileId, input.expertProfileId),
        inArray(t.status, [...main.OPEN_PARTNER_APPLICATION_STATUSES])
      )
    )
    .limit(1)
    .for("update")

  const now = new Date()
  if (open) {
    const [application] = await tx
      .update(t)
      .set({
        ...input.licence,
        status: "pending",
        submittedAt: now,
        reviewerUserId: null,
        reviewedAt: null,
        reason: null,
        updatedAt: now,
      })
      .where(eq(t.id, open.id))
      .returning()
    return { application: application!, refreshed: true }
  }

  const [application] = await tx
    .insert(t)
    .values({
      orgId: input.orgId,
      expertProfileId: input.expertProfileId,
      ...input.licence,
      status: "pending",
      submittedAt: now,
    })
    .returning()
  return { application: application!, refreshed: false }
}
