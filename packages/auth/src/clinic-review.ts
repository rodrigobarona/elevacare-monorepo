import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import type { ClinicChecklistItem } from "@eleva/config/clinic-verification"
import { auth, main, withPlatformAdminContext } from "@eleva/db"
import type { ClinicBillingAddress } from "@eleva/db/schema"

/**
 * Staff review of a clinic's legal identity (Phase 12, queue for the
 * filings clinics send in Phase 11.1): the legal name and the NIF are
 * checked against the public register before the clinic can be shown as
 * verified. A clinic is verified while an approved filing exists.
 */

export type ClinicDecision =
  | { decision: "approve"; checklist: Record<ClinicChecklistItem, true> }
  | { decision: "needs_changes"; reason: string }
  | { decision: "reject"; reason: string }

export type ClinicReviewErrorCode =
  | "VERIFICATION_NOT_FOUND"
  | "VERIFICATION_ALREADY_DECIDED"
  | "VERIFICATION_CHANGED"
  | "SELF_REVIEW"

const ERROR_STATUS: Record<ClinicReviewErrorCode, number> = {
  VERIFICATION_NOT_FOUND: 404,
  VERIFICATION_ALREADY_DECIDED: 409,
  VERIFICATION_CHANGED: 409,
  SELF_REVIEW: 403,
}

export class ClinicReviewError extends Error {
  readonly status: number

  constructor(readonly code: ClinicReviewErrorCode) {
    super(code)
    this.name = "ClinicReviewError"
    this.status = ERROR_STATUS[code]
  }
}

const OUTCOMES = {
  approve: { status: "approved", auditAction: "approved" },
  needs_changes: { status: "needs_changes", auditAction: "changes_requested" },
  reject: { status: "rejected", auditAction: "rejected" },
} as const

type VerificationStatus = main.ClinicVerification["status"]

export interface ClinicVerificationQueueRow {
  verificationId: string
  orgId: string
  clinicName: string
  legalName: string
  countryCode: string | null
  status: VerificationStatus
  /** Another filing of this clinic is already approved. */
  verified: boolean
  waitingSince: Date
}

/**
 * Filings waiting on staff (`pending`, oldest first), then the ones sent
 * back to the clinic (`needs_changes`), which wait on the clinic.
 */
export async function listClinicVerificationQueue(): Promise<
  ClinicVerificationQueueRow[]
> {
  const v = main.clinicVerifications
  const c = main.clinicProfiles
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        verificationId: v.id,
        orgId: v.orgId,
        clinicName: c.displayName,
        legalName: v.legalName,
        countryCode: c.countryCode,
        status: v.status,
        waitingSince: v.submittedAt,
        verified: sql<boolean>`exists (
          select 1 from ${v} approved
          where approved.org_id = ${v.orgId} and approved.status = 'approved'
        )`,
      })
      .from(v)
      .innerJoin(c, eq(c.orgId, v.orgId))
      .where(inArray(v.status, ["pending", "needs_changes"]))
      .orderBy(desc(sql`${v.status} = 'pending'`), asc(v.submittedAt))
    return rows
  })
}

export interface ClinicVerificationFiling {
  id: string
  status: VerificationStatus
  legalName: string
  taxId: string
  submittedAt: Date
  reviewedAt: Date | null
  reason: string | null
}

export interface ClinicVerificationReview {
  verification: ClinicVerificationFiling
  clinic: {
    orgId: string
    displayName: string
    slug: string
    websiteUrl: string | null
    countryCode: string | null
    billingAddress: ClinicBillingAddress
  }
  /** The clinic's owner, the person staff write to. */
  owner: { name: string; email: string } | null
  people: number
  /** An approved filing exists (this one or another one). */
  verified: boolean
  /** Filings of the same clinic sent before this one, newest first. */
  history: ClinicVerificationFiling[]
}

const FILING_COLUMNS = {
  id: main.clinicVerifications.id,
  status: main.clinicVerifications.status,
  legalName: main.clinicVerifications.legalName,
  taxId: main.clinicVerifications.taxId,
  submittedAt: main.clinicVerifications.submittedAt,
  reviewedAt: main.clinicVerifications.reviewedAt,
  reason: main.clinicVerifications.reason,
}

/** One filing with what staff need to check it. Null when unknown. */
export async function getClinicVerificationReview(
  verificationId: string
): Promise<ClinicVerificationReview | null> {
  const v = main.clinicVerifications
  const c = main.clinicProfiles
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        ...FILING_COLUMNS,
        orgId: v.orgId,
        displayName: c.displayName,
        slug: c.slug,
        websiteUrl: c.websiteUrl,
        countryCode: c.countryCode,
        billingAddress: c.billingAddress,
      })
      .from(v)
      .innerJoin(c, eq(c.orgId, v.orgId))
      .where(eq(v.id, verificationId))
      .limit(1)
    if (!row) return null

    const filings = await tx
      .select(FILING_COLUMNS)
      .from(v)
      .where(eq(v.orgId, row.orgId))
      .orderBy(desc(v.submittedAt))
    // Only the owner's name and address are read; everyone else is a count.
    const members = await tx
      .select({ userId: auth.member.userId, role: auth.member.role })
      .from(auth.member)
      .where(eq(auth.member.organizationId, row.orgId))
    const ownerId = members.find((m) =>
      m.role.split(",").includes("owner")
    )?.userId
    const [owner] = ownerId
      ? await tx
          .select({ name: auth.user.name, email: auth.user.email })
          .from(auth.user)
          .where(eq(auth.user.id, ownerId))
          .limit(1)
      : []

    const {
      orgId,
      displayName,
      slug,
      websiteUrl,
      countryCode,
      billingAddress,
      ...verification
    } = row
    return {
      verification,
      clinic: {
        orgId,
        displayName,
        slug,
        websiteUrl,
        countryCode,
        billingAddress,
      },
      owner: owner ? { name: owner.name, email: owner.email } : null,
      people: members.length,
      verified: filings.some((filing) => filing.status === "approved"),
      history: filings.filter(
        (filing) =>
          filing.id !== verificationId &&
          filing.submittedAt.getTime() < verification.submittedAt.getTime()
      ),
    }
  })
}

/**
 * Staff decision on a pending filing. The staff member must see what they
 * decide: `submittedAt` is the filing they reviewed, and a refile since
 * then refuses with `VERIFICATION_CHANGED`. Nobody decides for a clinic
 * they belong to. Approval records who checked and both checks; a clinic
 * already verified under an earlier filing stays verified whatever the
 * decision on a new one.
 */
export async function decideClinicVerification(input: {
  verificationId: string
  submittedAt: Date
  actorUserId: string
  decision: ClinicDecision
}): Promise<{ status: VerificationStatus; verified: boolean }> {
  const v = main.clinicVerifications
  const [probe] = await withPlatformAdminContext((tx) =>
    tx
      .select({ orgId: v.orgId })
      .from(v)
      .where(eq(v.id, input.verificationId))
      .limit(1)
  )
  if (!probe) throw new ClinicReviewError("VERIFICATION_NOT_FOUND")
  const { orgId } = probe
  const { decision } = input
  const outcome = OUTCOMES[decision.decision]

  return withPlatformAudit(
    { orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [membership] = await tx
        .select({ id: auth.member.id })
        .from(auth.member)
        .where(
          and(
            eq(auth.member.organizationId, orgId),
            eq(auth.member.userId, input.actorUserId)
          )
        )
        .limit(1)
      if (membership) throw new ClinicReviewError("SELF_REVIEW")

      const [filing] = await tx
        .select()
        .from(v)
        .where(and(eq(v.id, input.verificationId), eq(v.status, "pending")))
        .limit(1)
        .for("update")
      if (!filing) throw new ClinicReviewError("VERIFICATION_ALREADY_DECIDED")
      if (filing.submittedAt.getTime() !== input.submittedAt.getTime()) {
        throw new ClinicReviewError("VERIFICATION_CHANGED")
      }

      const reviewedAt = new Date()
      const reason = decision.decision === "approve" ? null : decision.reason
      await tx
        .update(v)
        .set({
          status: outcome.status,
          reviewerUserId: input.actorUserId,
          reviewedAt,
          reason,
          checklist: decision.decision === "approve" ? decision.checklist : {},
          updatedAt: reviewedAt,
        })
        .where(eq(v.id, filing.id))

      const [approved] = await tx
        .select({ id: v.id })
        .from(v)
        .where(and(eq(v.orgId, orgId), eq(v.status, "approved")))
        .limit(1)
      await ctx.emit({
        entity: "clinic_verification",
        action: outcome.auditAction,
        entityId: filing.id,
        payload: {
          fromStatus: filing.status,
          status: outcome.status,
          ...(decision.decision === "approve"
            ? { checklist: decision.checklist }
            : { reason }),
        },
      })
      return { status: outcome.status, verified: Boolean(approved) }
    }
  )
}
