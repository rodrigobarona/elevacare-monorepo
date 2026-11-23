import { and, eq, inArray, isNull } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { STAFF_QUEUE_PAGE_SIZE } from "@eleva/config/pagination"
import type { LicenceChecklistItem } from "@eleva/config/professional-bodies"
import { main, withPlatformAdminContext } from "@eleva/db"
import {
  _emitPartnerDecisionEvent,
  _listLicenceReviewQueue,
  _readLicenceReview,
  type LicenceReview,
  type LicenceReviewQueueRow,
} from "@eleva/db/queries/partner-applications"
import {
  servedQueuePage,
  type StaffQueuePage,
  type StaffQueueReader,
} from "./staff-queue"

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

function nextProfileStatus(
  decision: LicenceDecision["decision"],
  status: main.ExpertProfile["status"]
): main.ExpertProfile["status"] {
  if (decision === "approve" && status === "approved") return "active"
  if (decision === "reject" && status === "active") return "approved"
  return status
}

/**
 * Staff decision on an open licence application. The staff member must see
 * what they decide: `submittedAt` is the filing they reviewed, and a refile
 * since then refuses with `APPLICATION_CHANGED`.
 *
 * Approval is the verification record, and it puts the licence staff checked
 * on the profile. `approved` moves to `active`; `active` stays; `suspended`
 * stays paused. Rejection unlists: `active` moves back to `approved`, so a
 * later approval lists the expert again. Needs changes leaves the profile
 * alone, and a listed profile stays in the queue as "Needs verification"
 * until a licence is approved.
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

      const profileStatus = nextProfileStatus(decision.decision, profile.status)
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
      } else if (profileStatus !== profile.status) {
        await tx
          .update(p)
          .set({ status: profileStatus, updatedAt: reviewedAt })
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

/**
 * One page of the licence review queue: the licences that wait on staff,
 * oldest first, then everything else in the queue, oldest first.
 *
 * A page shows people's names and their regulator to a staff member, so
 * each read is recorded (`partner_application.listed`) in the same
 * transaction: who read, which page, how many rows, and how the read was
 * made. Never the names. The record sits under the staff workspace: a page
 * spans many practices.
 */
export async function listLicenceQueue(input: {
  page: number
  viewer: StaffQueueReader
}): Promise<StaffQueuePage<LicenceReviewQueueRow>> {
  return withPlatformAudit(input.viewer, async (tx, ctx) => {
    const { rows, window } = await _listLicenceReviewQueue(tx, {
      page: input.page,
      pageSize: STAFF_QUEUE_PAGE_SIZE,
    })
    return servedQueuePage(
      ctx,
      "partner_application",
      input.viewer,
      rows,
      window
    )
  })
}

/**
 * One profile's licence review, for staff. Null when the profile is unknown.
 *
 * It shows a person's email, licence number and regulator number, so each
 * opening is recorded (`partner_application.opened`) in the same
 * transaction as the read: who looked, at whose licence, in which state.
 * The record never holds the numbers themselves.
 */
export async function openLicenceReview(
  expertProfileId: string,
  viewer: { actorUserId: string }
): Promise<LicenceReview | null> {
  const p = main.expertProfiles
  const [probe] = await withPlatformAdminContext((tx) =>
    tx
      .select({ orgId: p.orgId })
      .from(p)
      .where(and(eq(p.id, expertProfileId), isNull(p.deletedAt)))
      .limit(1)
  )
  if (!probe) return null
  try {
    return await withPlatformAudit(
      { orgId: probe.orgId, actorUserId: viewer.actorUserId },
      async (tx, ctx) => {
        const review = await _readLicenceReview(tx, expertProfileId)
        // Gone between the two reads: nothing was shown, nothing to record.
        if (!review) throw new PartnerReviewError("APPLICATION_NOT_FOUND")
        await ctx.emit({
          entity: "partner_application",
          action: "opened",
          // A profile with no filing yet has no application to name.
          entityId: review.application?.id ?? null,
          payload: { expertProfileId, reviewState: review.reviewState },
        })
        return review
      }
    )
  } catch (err) {
    if (
      err instanceof PartnerReviewError &&
      err.code === "APPLICATION_NOT_FOUND"
    ) {
      return null
    }
    throw err
  }
}
