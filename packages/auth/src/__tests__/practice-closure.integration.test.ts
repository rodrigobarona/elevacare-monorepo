import { randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  auth,
  db,
  findExpertByUsername,
  isClosedPublicPractice,
  main,
  withOrgContext,
} from "@eleva/db"
import { lockOpenExpertProfile } from "@eleva/db/queries/practice-closure"
import {
  closedPracticeViolation,
  closeExpertPractice,
  getPracticeClosureState,
  PracticeClosureError,
  reopenExpertPractice,
  sweepClosedPractice,
} from "../practice-closure"

/**
 * Close and reopen a real practice on the PR's Neon branch (ADR-026
 * decision 10): blockers refuse and roll back, the owner closes, delegates
 * and invitations end, every public read hides it, and reopening restores
 * it. Runs with ELEVA_DB_INTEGRATION=1 in neon-branch-migrate-and-rls, as
 * the app's own database role (like production), not the restricted RLS
 * test role: closing also removes Better Auth members and invitations.
 */
const enabled =
  process.env.ELEVA_DB_INTEGRATION === "1" &&
  process.env.ELEVA_RLS_INTEGRATION !== "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (err) {
    if (err instanceof PracticeClosureError) return err
    throw err
  }
  throw new Error("expected a PracticeClosureError")
}

describe.skipIf(!enabled || !databaseUrl)(
  "expert practice closure",
  { timeout: 90_000 },
  () => {
    const orgId = randomUUID()
    const owner = randomUUID()
    const delegate = randomUUID()
    const reviewer = randomUUID()
    const profileId = randomUUID()
    const subscriptionId = randomUUID()
    const slug = `close-${orgId.slice(0, 8)}`

    async function closedAt() {
      const [row] = await db()
        .select({ closedAt: main.expertProfiles.closedAt })
        .from(main.expertProfiles)
        .where(eq(main.expertProfiles.id, profileId))
      return row?.closedAt ?? null
    }

    beforeAll(async () => {
      await db()
        .insert(auth.user)
        .values(
          [owner, delegate, reviewer].map((id) => ({
            id,
            name: `Closure ${id.slice(0, 6)}`,
            email: `closure-${id}@example.test`,
          }))
        )
      await db()
        .insert(auth.organization)
        .values({ id: orgId, name: "Closure test", slug, type: "expert" })
      await db()
        .insert(auth.member)
        .values([
          { organizationId: orgId, userId: owner, role: "owner" },
          { organizationId: orgId, userId: delegate, role: "admin" },
        ])
      await db()
        .insert(auth.invitation)
        .values({
          organizationId: orgId,
          email: `closure-invitee-${orgId}@example.test`,
          role: "admin",
          inviterId: owner,
          expiresAt: new Date(Date.now() + 86_400_000),
        })
      await db().insert(main.expertProfiles).values({
        id: profileId,
        orgId,
        userId: owner,
        username: slug,
        displayName: "Closure Test",
        status: "active",
      })
      await db()
        .insert(main.becomePartnerApplications)
        .values({
          orgId,
          expertProfileId: profileId,
          status: "approved",
          professionalBody: "ordem_fisioterapeutas",
          licenceNumber: "TEST-0000",
          ersRegistrationNumber: "TEST-E00",
          reviewerUserId: reviewer,
          reviewedAt: new Date(),
          checklist: {
            register_checked: true,
            name_matches: true,
            ers_checked: true,
          },
        })
      // An unpaid Eleva subscription blocks the closure until settled.
      await db()
        .insert(main.billingSubscriptions)
        .values({
          id: subscriptionId,
          orgId,
          stripeSubscriptionId: `sub_closure_${orgId.slice(0, 8)}`,
          stripeCustomerId: `cus_closure_${orgId.slice(0, 8)}`,
          status: "past_due",
        })
    })

    afterAll(async () => {
      await db()
        .delete(main.auditOutbox)
        .where(eq(main.auditOutbox.orgId, orgId))
      await db()
        .delete(auth.organization)
        .where(eq(auth.organization.id, orgId))
      await db()
        .delete(auth.user)
        .where(inArray(auth.user.id, [owner, delegate, reviewer]))
    })

    it("lists what blocks the closure without changing anything", async () => {
      const state = await getPracticeClosureState(orgId)
      expect(state).toMatchObject({
        slug,
        closedAt: null,
        canClose: false,
        blockers: [{ code: "UNPAID_SUBSCRIPTION", count: 1 }],
      })
    })

    it("lets only the owner close, with the username typed", async () => {
      expect(
        (
          await refusal(
            closeExpertPractice({
              orgId,
              actorUserId: delegate,
              confirmSlug: slug,
            })
          )
        ).code
      ).toBe("PRACTICE_OWNER_REQUIRED")
      expect(
        (
          await refusal(
            closeExpertPractice({
              orgId,
              actorUserId: owner,
              confirmSlug: "someone-else",
            })
          )
        ).code
      ).toBe("CLOSURE_CONFIRMATION_MISMATCH")
    })

    it("refuses while something blocks it, and rolls back", async () => {
      const err = await refusal(
        closeExpertPractice({ orgId, actorUserId: owner, confirmSlug: slug })
      )
      expect(err.code).toBe("PRACTICE_CLOSURE_BLOCKED")
      expect(err.blockers).toEqual([{ code: "UNPAID_SUBSCRIPTION", count: 1 }])
      expect(await closedAt()).toBeNull()
    })

    it("closes: hidden everywhere public, delegates and invitations end", async () => {
      await db()
        .update(main.billingSubscriptions)
        .set({ status: "active" })
        .where(eq(main.billingSubscriptions.id, subscriptionId))
      expect(await findExpertByUsername(slug)).not.toBeNull()

      const result = await closeExpertPractice({
        orgId,
        actorUserId: owner,
        confirmSlug: ` ${slug.toUpperCase()} `,
      })
      expect(result).toMatchObject({
        slug,
        removedMembers: 1,
        cancelledInvitations: 1,
      })
      expect(await closedAt()).toBeInstanceOf(Date)

      const members = await db()
        .select({ userId: auth.member.userId })
        .from(auth.member)
        .where(eq(auth.member.organizationId, orgId))
      expect(members.map((m) => m.userId)).toEqual([owner])
      const [invite] = await db()
        .select({ status: auth.invitation.status })
        .from(auth.invitation)
        .where(eq(auth.invitation.organizationId, orgId))
      expect(invite?.status).toBe("canceled")

      expect(await findExpertByUsername(slug)).toBeNull()
      expect(await isClosedPublicPractice(slug)).toBe(true)

      // New holds are refused under the shared lock, and nobody can be
      // invited or added back while closed.
      expect(
        await withOrgContext(orgId, (tx) =>
          lockOpenExpertProfile(tx, profileId)
        )
      ).toBe(false)
      expect(await closedPracticeViolation(orgId)).toMatch(/closed/)

      // A join that raced the closure lands after it: the sweep (run from
      // Better Auth's after-hooks and after every closure) evicts it.
      await db()
        .insert(auth.member)
        .values({ organizationId: orgId, userId: delegate, role: "admin" })
      expect(await sweepClosedPractice(orgId, owner)).toEqual({
        removedMembers: 1,
        cancelledInvitations: 0,
      })
      const afterSweep = await db()
        .select({ userId: auth.member.userId })
        .from(auth.member)
        .where(eq(auth.member.organizationId, orgId))
      expect(afterSweep.map((m) => m.userId)).toEqual([owner])
      expect(await sweepClosedPractice(orgId, owner)).toEqual({
        removedMembers: 0,
        cancelledInvitations: 0,
      })

      const audit = await db()
        .select({ action: main.auditOutbox.action })
        .from(main.auditOutbox)
        .where(
          and(
            eq(main.auditOutbox.orgId, orgId),
            eq(main.auditOutbox.action, "expert_profile.closed")
          )
        )
      expect(audit).toHaveLength(1)

      expect(
        (
          await refusal(
            closeExpertPractice({
              orgId,
              actorUserId: owner,
              confirmSlug: slug,
            })
          )
        ).code
      ).toBe("PRACTICE_ALREADY_CLOSED")
    })

    it("reopens: public again, and only once", async () => {
      await reopenExpertPractice({ orgId, actorUserId: owner })
      expect(await closedAt()).toBeNull()
      expect(await findExpertByUsername(slug)).not.toBeNull()
      expect(await isClosedPublicPractice(slug)).toBe(false)
      expect(
        await withOrgContext(orgId, (tx) =>
          lockOpenExpertProfile(tx, profileId)
        )
      ).toBe(true)
      expect(await closedPracticeViolation(orgId)).toBeNull()
      expect(
        (await refusal(reopenExpertPractice({ orgId, actorUserId: owner })))
          .code
      ).toBe("PRACTICE_NOT_CLOSED")
    })
  }
)
