import { randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { auth, db, main } from "@eleva/db"
import { openLicenceReview } from "../partner-review"

/**
 * Staff opening an expert's licence review, on the PR's Neon branch
 * (Phase 12.3): the review is returned and the opening is recorded with
 * the reader, in the expert's organization, without the licence numbers.
 * Runs with ELEVA_DB_INTEGRATION=1 in neon-branch-migrate-and-rls, as the
 * app's own database role.
 */
const enabled =
  process.env.ELEVA_DB_INTEGRATION === "1" &&
  process.env.ELEVA_RLS_INTEGRATION !== "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

describe.skipIf(!enabled || !databaseUrl)(
  "licence review read audit",
  { timeout: 120_000 },
  () => {
    const orgId = randomUUID()
    const expert = randomUUID()
    const staff = randomUUID()
    const profileId = randomUUID()
    const suffix = orgId.slice(0, 8)

    async function openings() {
      return db()
        .select({
          action: main.auditOutbox.action,
          entityId: main.auditOutbox.entityId,
          actorUserId: main.auditOutbox.actorUserId,
          payload: main.auditOutbox.payload,
        })
        .from(main.auditOutbox)
        .where(
          and(
            eq(main.auditOutbox.orgId, orgId),
            eq(main.auditOutbox.action, "partner_application.opened")
          )
        )
        .orderBy(main.auditOutbox.createdAt)
    }

    beforeAll(async () => {
      await db()
        .insert(auth.user)
        .values([
          {
            id: expert,
            name: "Licence Expert",
            email: `licence-${suffix}@example.test`,
          },
          {
            id: staff,
            name: "Staff Reviewer",
            email: `licence-staff-${suffix}@example.test`,
          },
        ])
      await db()
        .insert(auth.organization)
        .values({
          id: orgId,
          name: "Licence practice",
          slug: `licence-${suffix}`,
          type: "expert",
        })
      await db()
        .insert(auth.member)
        .values({ organizationId: orgId, userId: expert, role: "owner" })
      await db()
        .insert(main.expertProfiles)
        .values({
          id: profileId,
          orgId,
          userId: expert,
          username: `licence-${suffix}`,
          displayName: "Licence Expert",
          status: "draft",
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
        .where(inArray(auth.user.id, [expert, staff]))
    })

    it("records a profile that never filed, with no application to name", async () => {
      const before = (await openings()).length
      const review = await openLicenceReview(profileId, { actorUserId: staff })
      expect(review).toMatchObject({
        email: `licence-${suffix}@example.test`,
        reviewState: "not_submitted",
        application: null,
      })
      // Exactly one record for one opening.
      const rows = await openings()
      expect(rows).toHaveLength(before + 1)
      expect(rows.at(-1)).toEqual({
        action: "partner_application.opened",
        entityId: null,
        actorUserId: staff,
        payload: { expertProfileId: profileId, reviewState: "not_submitted" },
      })
    })

    it("names the application once there is one, and never its numbers", async () => {
      const [application] = await db()
        .insert(main.becomePartnerApplications)
        .values({
          orgId,
          expertProfileId: profileId,
          status: "pending",
          professionalBody: "ordem_fisioterapeutas",
          licenceNumber: "TEST-4242",
          ersRegistrationNumber: "TEST-E42",
        })
        .returning({ id: main.becomePartnerApplications.id })
      // Each case counts from what it found, so it can run on its own.
      const before = (await openings()).length
      const review = await openLicenceReview(profileId, { actorUserId: staff })
      expect(review?.application?.licenceNumber).toBe("TEST-4242")
      const rows = await openings()
      expect(rows).toHaveLength(before + 1)
      expect(rows.at(-1)).toEqual({
        action: "partner_application.opened",
        entityId: application!.id,
        actorUserId: staff,
        payload: { expertProfileId: profileId, reviewState: "pending" },
      })
      expect(JSON.stringify(rows)).not.toMatch(
        /TEST-4242|TEST-E42|example\.test/
      )
    })

    it("answers null for an unknown profile and records nothing", async () => {
      const before = (await openings()).length
      expect(
        await openLicenceReview(randomUUID(), { actorUserId: staff })
      ).toBeNull()
      expect(await openings()).toHaveLength(before)
    })
  }
)
