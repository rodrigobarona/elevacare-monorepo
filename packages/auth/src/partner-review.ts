import { and, eq, inArray } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import type { LicenceChecklistItem } from "@eleva/config/professional-bodies"
import { main, withPlatformAdminContext } from "@eleva/db"
import { _emitPartnerDecisionEvent } from "@eleva/db/queries/partner-applications"

export type LicenceDecision =
  | { decision: "approve"; checklist: Record<LicenceChecklistItem, true> }
  | { decision: "needs_changes"; reason: string }
  | { decision: "reject"; reason: string }

export type PartnerReviewErrorCode =
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_ALREADY_DECIDED"
  | "APPLICATION_CHANGED"
  | "SELF_REVIEW"

const ERROR_STATUS: Record<PartnerReviewErrorCode, number> = {
  APPLICATION_NOT_FOUND: 404,
  APPLICATION_ALREADY_DECIDED: 409,
  APPLICATION_CHANGED: 409,
  SELF_REVIEW: 403,
}

export class PartnerReviewError extends Error {
  readonly status: number

  constructor(readonly code: PartnerReviewErrorCode) {
    super(code)
    this.name = "PartnerReviewError"
    this.status = ERROR_STATUS[code]
  }
}

const OUTCOMES = {
  approve: {
    status: "approved",
    event: "partner.approved",
    auditAction: "approved",
  },
  needs_changes: {
    status: "needs_changes",
    event: "partner.needs_changes",
    auditAction: "changes_requested",
  },
  reject: {
    status: "rejected",
    event: "partner.rejected",
    auditAction: "rejected",
  },
} as const

/**
 * Staff decision on an open licence application. The staff member must see
 * what they decide: `submittedAt` is the filing they reviewed, and a refile
 * since then refuses with `APPLICATION_CHANGED`.
 *
 * Approval is the verification record, and it puts the licence staff checked
 * on the profile. `approved` moves to `active`; `active` stays; `suspended`
 * stays paused. Other decisions leave the profile status alone: a listed
 * profile stays listed (no auto-suspend) and in the queue as
 * "Needs verification" until a licence is approved.
 */
export async function decideLicenceApplication(input: {
  expertProfileId: string
  applicationId: string
  submittedAt: Date
  actorUserId: string
  decision: LicenceDecision
}): Promise<{
  status: main.PartnerApplicationStatus
  profileStatus: main.ExpertProfile["status"]
}> {
  const a = main.becomePartnerApplications
  const p = main.expertProfiles
  const scope = and(
    eq(a.id, input.applicationId),
    eq(a.expertProfileId, input.expertProfileId)
  )
  const [probe] = await withPlatformAdminContext((tx) =>
    tx.select({ orgId: a.orgId }).from(a).where(scope).limit(1)
  )
  if (!probe) throw new PartnerReviewError("APPLICATION_NOT_FOUND")
  const { orgId } = probe
  const { decision } = input
  const outcome = OUTCOMES[decision.decision]

  return withPlatformAudit(
    { orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [profile] = await tx
        .select({ status: p.status, userId: p.userId })
        .from(p)
        .where(eq(p.id, input.expertProfileId))
        .limit(1)
        .for("update")
      if (!profile) throw new PartnerReviewError("APPLICATION_NOT_FOUND")
      if (profile.userId === input.actorUserId) {
        throw new PartnerReviewError("SELF_REVIEW")
      }
      const [application] = await tx
        .select()
        .from(a)
        .where(
          and(
            scope,
            inArray(a.status, [...main.OPEN_PARTNER_APPLICATION_STATUSES])
          )
        )
        .limit(1)
        .for("update")
      if (!application) {
        throw new PartnerReviewError("APPLICATION_ALREADY_DECIDED")
      }
      if (application.submittedAt.getTime() !== input.submittedAt.getTime()) {
        throw new PartnerReviewError("APPLICATION_CHANGED")
      }

      const reviewedAt = new Date()
      const reason = decision.decision === "approve" ? null : decision.reason
      await tx
        .update(a)
        .set({
          status: outcome.status,
          reviewerUserId: input.actorUserId,
          reviewedAt,
          reason,
          checklist: decision.decision === "approve" ? decision.checklist : {},
          updatedAt: reviewedAt,
        })
        .where(eq(a.id, application.id))

      const profileStatus =
        decision.decision === "approve" && profile.status === "approved"
          ? "active"
          : profile.status
      if (decision.decision === "approve") {
        await tx
          .update(p)
          .set({
            status: profileStatus,
            professionalBody: application.professionalBody,
            licenceNumber: application.licenceNumber,
            ersRegistrationNumber: application.ersRegistrationNumber,
            updatedAt: reviewedAt,
          })
          .where(eq(p.id, input.expertProfileId))
      }

      await _emitPartnerDecisionEvent(tx, {
        orgId,
        type: outcome.event,
        applicationId: application.id,
        expertProfileId: input.expertProfileId,
        reason,
        reviewedAt,
      })
      await ctx.emit({
        entity: "partner_application",
        action: outcome.auditAction,
        entityId: application.id,
        payload: {
          expertProfileId: input.expertProfileId,
          professionalBody: application.professionalBody,
          fromStatus: application.status,
          status: outcome.status,
          profileStatusBefore: profile.status,
          profileStatus,
          ...(decision.decision === "approve"
            ? { checklist: decision.checklist }
            : { reason }),
        },
      })
      return { status: outcome.status, profileStatus }
    }
  )
}
