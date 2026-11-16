import { and, eq, isNotNull, isNull } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import type {
  PracticeClosureBlocker,
  PracticeClosureErrorCode,
} from "@eleva/config/practice-closure"
import { auth, db, main, withOrgContext } from "@eleva/db"
import {
  countPracticeClosureBlockers,
  practiceClosureBlockers,
} from "@eleva/db/queries/practice-closure"
import { toMembershipSeniority } from "./capabilities"
import { findOwnedExpertPractice } from "./expert-practice"

/**
 * An expert closes a practice; nobody deletes one (ADR-026 decision 10).
 * Closing hides the profile, its services and new bookings everywhere
 * public, ends delegate access and cancels pending invitations. Invoices,
 * payouts, the Stripe account, the audit trail and session records stay for
 * their retention periods, and the username stays held. The owner can
 * reopen while it is held.
 */

export class PracticeClosureError extends Error {
  constructor(
    readonly code: PracticeClosureErrorCode,
    message: string,
    readonly blockers: PracticeClosureBlocker[] = []
  ) {
    super(message)
    this.name = "PracticeClosureError"
  }
}

export interface PracticeClosureState {
  orgId: string
  slug: string
  closedAt: Date | null
  /** What must finish first; empty when the practice can close now. */
  blockers: PracticeClosureBlocker[]
  canClose: boolean
}

interface PracticeRow {
  profileId: string
  slug: string
  closedAt: Date | null
}

async function findPractice(orgId: string): Promise<PracticeRow> {
  const [row] = await db()
    .select({
      profileId: main.expertProfiles.id,
      slug: auth.organization.slug,
      closedAt: main.expertProfiles.closedAt,
    })
    .from(main.expertProfiles)
    .innerJoin(
      auth.organization,
      eq(auth.organization.id, main.expertProfiles.orgId)
    )
    .where(
      and(
        eq(main.expertProfiles.orgId, orgId),
        eq(auth.organization.type, "expert"),
        isNull(main.expertProfiles.deletedAt)
      )
    )
    .limit(1)
  if (!row) {
    throw new PracticeClosureError(
      "PRACTICE_NOT_FOUND",
      "This workspace is not an expert practice."
    )
  }
  return row
}

/** Only the person who owns the practice may close or reopen it. */
async function assertOwner(orgId: string, actorUserId: string) {
  const owned = await findOwnedExpertPractice(actorUserId)
  if (owned?.orgId !== orgId) {
    throw new PracticeClosureError(
      "PRACTICE_OWNER_REQUIRED",
      "Only the practice owner can close or reopen it."
    )
  }
}

/**
 * Guard for Better Auth's member and invitation hooks: nobody joins a
 * closed practice (ADR-026), so delegates removed at closure cannot come
 * back through a fresh invitation. Null when joining is allowed.
 */
export async function closedPracticeViolation(
  organizationId: string
): Promise<string | null> {
  const [row] = await db()
    .select({ id: main.expertProfiles.id })
    .from(main.expertProfiles)
    .where(
      and(
        eq(main.expertProfiles.orgId, organizationId),
        isNotNull(main.expertProfiles.closedAt),
        isNull(main.expertProfiles.deletedAt)
      )
    )
    .limit(1)
  return row
    ? "This practice is closed. Reopen it before inviting anyone."
    : null
}

/** The closure dry run: current state plus everything still blocking it. */
export async function getPracticeClosureState(
  orgId: string,
  now: Date = new Date()
): Promise<PracticeClosureState> {
  const practice = await findPractice(orgId)
  const blockers = practice.closedAt
    ? []
    : practiceClosureBlockers(
        await withOrgContext(orgId, (tx) =>
          countPracticeClosureBlockers(tx, orgId, now)
        )
      )
  return {
    orgId,
    slug: practice.slug,
    closedAt: practice.closedAt,
    blockers,
    canClose: !practice.closedAt && blockers.length === 0,
  }
}

export interface CloseExpertPracticeInput {
  orgId: string
  actorUserId: string
  /** The practice's username, typed by the person to confirm. */
  confirmSlug: string
  now?: Date
}

export interface CloseExpertPracticeResult {
  orgId: string
  slug: string
  closedAt: Date
  removedMembers: number
  cancelledInvitations: number
}

export async function closeExpertPractice(
  input: CloseExpertPracticeInput
): Promise<CloseExpertPracticeResult> {
  const now = input.now ?? new Date()
  const practice = await findPractice(input.orgId)
  await assertOwner(input.orgId, input.actorUserId)
  if (practice.closedAt) {
    throw new PracticeClosureError(
      "PRACTICE_ALREADY_CLOSED",
      "This practice is already closed."
    )
  }
  if (input.confirmSlug.trim().toLowerCase() !== practice.slug) {
    throw new PracticeClosureError(
      "CLOSURE_CONFIRMATION_MISMATCH",
      "Type the practice's username exactly to confirm."
    )
  }

  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      // Close first, then re-check inside the same transaction, so a
      // booking made a moment ago still blocks and rolls this back.
      const closed = await tx
        .update(main.expertProfiles)
        .set({ closedAt: now })
        .where(
          and(
            eq(main.expertProfiles.id, practice.profileId),
            isNull(main.expertProfiles.closedAt)
          )
        )
        .returning({ id: main.expertProfiles.id })
      if (closed.length === 0) {
        throw new PracticeClosureError(
          "PRACTICE_ALREADY_CLOSED",
          "This practice is already closed."
        )
      }
      const blockers = practiceClosureBlockers(
        await countPracticeClosureBlockers(tx, input.orgId, now)
      )
      if (blockers.length > 0) {
        throw new PracticeClosureError(
          "PRACTICE_CLOSURE_BLOCKED",
          "Some things need to finish before this practice can close.",
          blockers
        )
      }

      // Delegate access ends: everyone but the owner leaves the practice.
      const members = await tx
        .select({ id: auth.member.id, role: auth.member.role })
        .from(auth.member)
        .where(eq(auth.member.organizationId, input.orgId))
      const delegateIds = members
        .filter((m) => toMembershipSeniority(m.role) !== "owner")
        .map((m) => m.id)
      for (const id of delegateIds) {
        await tx.delete(auth.member).where(eq(auth.member.id, id))
      }
      const cancelled = await tx
        .update(auth.invitation)
        .set({ status: "canceled" })
        .where(
          and(
            eq(auth.invitation.organizationId, input.orgId),
            eq(auth.invitation.status, "pending")
          )
        )
        .returning({ id: auth.invitation.id })

      await ctx.emit({
        entity: "expert_profile",
        action: "closed",
        entityId: practice.profileId,
        payload: {
          slug: practice.slug,
          closedAt: now.toISOString(),
          removedMembers: delegateIds.length,
          cancelledInvitations: cancelled.length,
        },
      })
      return {
        orgId: input.orgId,
        slug: practice.slug,
        closedAt: now,
        removedMembers: delegateIds.length,
        cancelledInvitations: cancelled.length,
      }
    }
  )
}

export interface ReopenExpertPracticeInput {
  orgId: string
  actorUserId: string
}

/**
 * Reopen a closed practice. The profile shows again only if it still passes
 * the public checks (active, licence verified); delegates are invited again.
 */
export async function reopenExpertPractice(
  input: ReopenExpertPracticeInput
): Promise<{ orgId: string; slug: string }> {
  const practice = await findPractice(input.orgId)
  await assertOwner(input.orgId, input.actorUserId)

  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const reopened = await tx
        .update(main.expertProfiles)
        .set({ closedAt: null })
        .where(
          and(
            eq(main.expertProfiles.id, practice.profileId),
            isNotNull(main.expertProfiles.closedAt)
          )
        )
        .returning({ id: main.expertProfiles.id })
      if (reopened.length === 0) {
        throw new PracticeClosureError(
          "PRACTICE_NOT_CLOSED",
          "This practice is open."
        )
      }
      await ctx.emit({
        entity: "expert_profile",
        action: "reactivated",
        entityId: practice.profileId,
        payload: {
          slug: practice.slug,
          closedAt: practice.closedAt?.toISOString() ?? null,
        },
      })
      return { orgId: input.orgId, slug: practice.slug }
    }
  )
}
