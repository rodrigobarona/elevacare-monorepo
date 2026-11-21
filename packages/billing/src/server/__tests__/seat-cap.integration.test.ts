import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { auth, db, main, withOrgContext } from "@eleva/db"
import {
  assertSeatAvailable,
  CLINIC_SEAT_CAPS,
  SeatLimitReachedError,
} from "../seat-cap"

/**
 * The clinic seat limit on the PR's Neon branch (Phase 11.3): a member's
 * first published service takes a seat, the plan decides how many there
 * are, and two members cannot both take the last one. Runs with
 * ELEVA_DB_INTEGRATION=1 in neon-branch-migrate-and-rls, as the app's own
 * database role.
 */
const enabled =
  process.env.ELEVA_DB_INTEGRATION === "1" &&
  process.env.ELEVA_RLS_INTEGRATION !== "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

const STARTER = CLINIC_SEAT_CAPS.clinic_starter

describe.skipIf(!enabled || !databaseUrl)(
  "clinic seat limit",
  { timeout: 120_000 },
  () => {
    const clinicId = randomUUID()
    const practiceId = randomUUID()
    // Starter seats, plus two members who want the last seat and a spare.
    const clinicians = Array.from({ length: STARTER + 2 }, () => randomUUID())
    const soloExpert = randomUUID()
    const profiles = new Map<string, string>()
    const services = new Map<string, string>()
    const suffix = clinicId.slice(0, 8)

    /** Publish the way the route does: check for a seat, then write. */
    async function publish(userId: string, holdMs = 0): Promise<void> {
      await withOrgContext(clinicId, async (tx) => {
        await assertSeatAvailable(tx, { orgId: clinicId, userId })
        if (holdMs) await new Promise((r) => setTimeout(r, holdMs))
        await tx
          .update(main.eventTypes)
          .set({ published: true })
          .where(eq(main.eventTypes.id, services.get(userId)!))
      })
    }

    async function refused(promise: Promise<void>) {
      try {
        await promise
      } catch (err) {
        if (err instanceof SeatLimitReachedError) return err
        throw err
      }
      return null
    }

    beforeAll(async () => {
      const users = [...clinicians, soloExpert]
      await db()
        .insert(auth.user)
        .values(
          users.map((id) => ({
            id,
            name: `Seat ${id.slice(0, 6)}`,
            email: `seat-${id}@example.test`,
          }))
        )
      await db()
        .insert(auth.organization)
        .values([
          {
            id: clinicId,
            name: "Seat clinic",
            slug: `seat-${suffix}`,
            type: "team",
          },
          {
            id: practiceId,
            name: "Seat practice",
            slug: `seat-solo-${suffix}`,
            type: "expert",
          },
        ])
      await db()
        .insert(auth.member)
        .values([
          ...clinicians.map((userId, index) => ({
            organizationId: clinicId,
            userId,
            role: index === 0 ? "owner" : "member",
          })),
          { organizationId: practiceId, userId: soloExpert, role: "owner" },
        ])
      for (const [index, userId] of [...clinicians, soloExpert].entries()) {
        const orgId = userId === soloExpert ? practiceId : clinicId
        const profileId = randomUUID()
        const serviceId = randomUUID()
        profiles.set(userId, profileId)
        services.set(userId, serviceId)
        await db()
          .insert(main.expertProfiles)
          .values({
            id: profileId,
            orgId,
            userId,
            username: `seat-${suffix}-${index}`,
            displayName: `Seat ${index}`,
            status: "active",
          })
        await db()
          .insert(main.eventTypes)
          .values({
            id: serviceId,
            orgId,
            expertProfileId: profileId,
            slug: "first-visit",
            title: { en: "First visit" },
            published: false,
          })
      }
    })

    afterAll(async () => {
      await db()
        .delete(auth.organization)
        .where(inArray(auth.organization.id, [clinicId, practiceId]))
      await db()
        .delete(auth.user)
        .where(inArray(auth.user.id, [...clinicians, soloExpert]))
    })

    it("never limits a practice that is not a clinic", async () => {
      await withOrgContext(practiceId, (tx) =>
        assertSeatAvailable(tx, { orgId: practiceId, userId: soloExpert })
      )
    })

    it("fills the plan's seats, then gives the last one to exactly one of two", async () => {
      // Without a subscription row the clinic is held to Starter.
      for (const userId of clinicians.slice(0, STARTER - 1)) {
        expect(await refused(publish(userId))).toBeNull()
      }
      const [a, b] = clinicians.slice(STARTER - 1, STARTER + 1)
      const results = await Promise.all([
        refused(publish(a!, 300)),
        refused(publish(b!, 300)),
      ])
      const refusals = results.filter((r) => r !== null)
      expect(refusals).toHaveLength(1)
      expect(refusals[0]).toMatchObject({
        cap: STARTER,
        plan: "clinic_starter",
      })
    })

    it("refuses one more member, but not another service of a seated one", async () => {
      const spare = clinicians[STARTER + 1]!
      const err = await refused(publish(spare))
      expect(err).toMatchObject({ cap: STARTER, plan: "clinic_starter" })
      // The owner already holds a seat: a second service takes none.
      await withOrgContext(clinicId, (tx) =>
        assertSeatAvailable(tx, { orgId: clinicId, userId: clinicians[0]! })
      )
    })

    it("ignores a plan that has ended", async () => {
      // An old Growth subscription, canceled: the clinic is still on Starter.
      await db()
        .insert(main.billingSubscriptions)
        .values({
          orgId: clinicId,
          stripeSubscriptionId: `sub_seat_old_${suffix}`,
          stripeCustomerId: `cus_seat_${suffix}`,
          status: "canceled",
          tier: "clinic_growth",
        })
      const spare = clinicians[STARTER + 1]!
      expect(await refused(publish(spare))).toMatchObject({
        cap: STARTER,
        plan: "clinic_starter",
      })
    })

    it("follows the plan: Growth has room for more", async () => {
      // The current plan wins whatever row was touched last.
      await db()
        .insert(main.billingSubscriptions)
        .values({
          orgId: clinicId,
          stripeSubscriptionId: `sub_seat_${suffix}`,
          stripeCustomerId: `cus_seat_${suffix}`,
          status: "active",
          tier: "clinic_growth",
        })
      await db()
        .update(main.billingSubscriptions)
        .set({ updatedAt: new Date() })
        .where(
          eq(
            main.billingSubscriptions.stripeSubscriptionId,
            `sub_seat_old_${suffix}`
          )
        )
      const waiting = clinicians.filter((userId) => userId !== clinicians[0])
      for (const userId of waiting) {
        expect(await refused(publish(userId))).toBeNull()
      }
    })

    it("frees a seat when a member's service is unpublished", async () => {
      await db()
        .update(main.billingSubscriptions)
        .set({ tier: "clinic_starter" })
        .where(
          eq(
            main.billingSubscriptions.stripeSubscriptionId,
            `sub_seat_${suffix}`
          )
        )
      // Seven seated on a plan of five: nobody new gets in.
      const newcomer = randomUUID()
      await db()
        .insert(auth.user)
        .values({
          id: newcomer,
          name: "Seat newcomer",
          email: `seat-${newcomer}@example.test`,
        })
      await db()
        .insert(auth.member)
        .values({ organizationId: clinicId, userId: newcomer, role: "member" })
      try {
        const check = () =>
          refused(
            withOrgContext(clinicId, (tx) =>
              assertSeatAvailable(tx, { orgId: clinicId, userId: newcomer })
            )
          )
        expect(await check()).toMatchObject({ cap: STARTER })
        // Three leave their seats: four seated, one free.
        await db()
          .update(main.eventTypes)
          .set({ published: false })
          .where(
            inArray(
              main.eventTypes.id,
              clinicians.slice(1, 4).map((userId) => services.get(userId)!)
            )
          )
        expect(await check()).toBeNull()
      } finally {
        await db().delete(auth.user).where(eq(auth.user.id, newcomer))
      }
    })
  }
)
