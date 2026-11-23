import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import type Stripe from "stripe"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { auth, db, main } from "@eleva/db"
import { syncSeatQuantityAudited, type SeatGateway } from "../seats"
import { handleSubscriptionEvent } from "../webhook"

/**
 * Clinic seat billing on the PR's Neon branch (Phase 11.7): what the
 * subscription webhook writes to the mirror, and which subscription the
 * seat sync then bills. Stripe is a recording fake; every query is real.
 * Runs with ELEVA_DB_INTEGRATION=1 in neon-branch-migrate-and-rls, as the
 * app's own database role.
 *
 * One clinic's subscription is followed from unpaid to canceled, so the
 * cases are steps of one story and run in the order written (`sequential`):
 * each starts from the rows the one before left.
 */
const enabled =
  process.env.ELEVA_DB_INTEGRATION === "1" &&
  process.env.ELEVA_RLS_INTEGRATION !== "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

describe
  .skipIf(!enabled || !databaseUrl)
  .sequential(
    "clinic seat billing, from unpaid to canceled",
    { timeout: 120_000 },
    () => {
      const clinicId = randomUUID()
      const ownerId = randomUUID()
      const suffix = clinicId.slice(0, 8)
      const customer = `cus_test_${suffix}`
      const PAID = `sub_test_paid_${suffix}`
      const UNPAID = `sub_test_unpaid_${suffix}`
      const start = Math.floor(Date.now() / 1000) - 600

      function subscription(
        id: string,
        status: string,
        options: { seatItem?: boolean; metadata?: Record<string, string> } = {}
      ) {
        const item = (itemId: string, type: string) => ({
          id: itemId,
          price: { id: `price_${type}`, metadata: { eleva_price_type: type } },
          current_period_start: start,
          current_period_end: start + 30 * 86_400,
        })
        return {
          id,
          customer,
          status,
          cancel_at_period_end: false,
          canceled_at: null,
          metadata: {
            eleva_org_id: clinicId,
            eleva_tier: "clinic_starter",
            ...options.metadata,
          },
          items: {
            data: [
              item(`si_plan_${id}`, "base"),
              ...(options.seatItem ? [item(`si_seat_${id}`, "per_seat")] : []),
            ],
          },
        }
      }

      /** Deliver one subscription event, `seconds` after the first. */
      function deliver(
        type: string,
        seconds: number,
        object: ReturnType<typeof subscription>
      ) {
        return handleSubscriptionEvent({
          id: `evt_${randomUUID()}`,
          type,
          created: start + seconds,
          data: { object },
        } as unknown as Stripe.Event)
      }

      async function mirror(stripeSubscriptionId: string) {
        const [row] = await db()
          .select()
          .from(main.billingSubscriptions)
          .where(
            eq(
              main.billingSubscriptions.stripeSubscriptionId,
              stripeSubscriptionId
            )
          )
        return row
      }

      /** A Stripe that records what the sync asks of it. */
      function recordingGateway() {
        const calls: string[] = []
        const gateway: SeatGateway = {
          setQuantity: vi.fn(async (itemId, quantity) => {
            calls.push(`set ${itemId} ${quantity}`)
          }),
          ensureSeatItem: vi.fn(async (subscriptionId, quantity) => {
            calls.push(`ensure ${subscriptionId} ${quantity}`)
            return { itemId: "si_made_by_sync", created: true }
          }),
        }
        return { gateway, calls }
      }

      beforeAll(async () => {
        await db()
          .insert(auth.user)
          .values({
            id: ownerId,
            name: "Seat sync owner",
            email: `seat-sync-${ownerId}@example.test`,
          })
        await db()
          .insert(auth.organization)
          .values({
            id: clinicId,
            name: "Seat sync clinic",
            slug: `seat-sync-${suffix}`,
            type: "team",
          })
        await db()
          .insert(auth.member)
          .values({ organizationId: clinicId, userId: ownerId, role: "owner" })
        const profileId = randomUUID()
        await db()
          .insert(main.expertProfiles)
          .values({
            id: profileId,
            orgId: clinicId,
            userId: ownerId,
            username: `seat-sync-${suffix}`,
            displayName: "Seat sync",
            status: "active",
          })
        // One member with a published service: one seat.
        await db()
          .insert(main.eventTypes)
          .values({
            orgId: clinicId,
            expertProfileId: profileId,
            slug: "first-visit",
            title: { en: "First visit" },
            published: true,
          })
      })

      afterAll(async () => {
        await db()
          .delete(auth.organization)
          .where(inArray(auth.organization.id, [clinicId]))
        await db().delete(auth.user).where(eq(auth.user.id, ownerId))
      })

      it("1. mirrors an unpaid subscription and asks for no seat sync", async () => {
        // What provisioning creates: it expires unpaid after a day.
        await deliver(
          "customer.subscription.created",
          0,
          subscription(UNPAID, "incomplete", { seatItem: true })
        )
        await deliver(
          "customer.subscription.updated",
          60,
          subscription(UNPAID, "incomplete_expired", { seatItem: true })
        )
        const row = await mirror(UNPAID)
        expect(row).toMatchObject({
          orgId: clinicId,
          status: "incomplete_expired",
          tier: "clinic_starter",
          seatItemId: `si_seat_${UNPAID}`,
        })
        expect(row?.metadata).not.toHaveProperty("seatSyncPending")
      })

      it("2. marks a seat sync when a clinic plan becomes current", async () => {
        // Paid in Checkout with no seats: Checkout refuses a line at zero.
        await deliver(
          "customer.subscription.created",
          120,
          subscription(PAID, "incomplete")
        )
        expect((await mirror(PAID))?.metadata).not.toHaveProperty(
          "seatSyncPending"
        )
        await deliver(
          "customer.subscription.updated",
          180,
          subscription(PAID, "active")
        )
        const row = await mirror(PAID)
        expect(row).toMatchObject({ status: "active", seatItemId: null })
        expect(row?.metadata).toMatchObject({
          seatSyncPending: true,
          eleva_tier: "clinic_starter",
        })
        expect(row?.metadata?.seatSyncGeneration).toEqual(expect.any(Number))
      })

      it("3. bills seats on the current subscription, never the unpaid one beside it", async () => {
        const { gateway, calls } = recordingGateway()
        const result = await syncSeatQuantityAudited(clinicId, null, {
          gateway,
        })
        // One member with a published service; the paid plan has no item yet.
        expect(calls).toEqual([`ensure ${PAID} 1`])
        expect(result).toMatchObject({ synced: true, quantity: 1 })
        // The new item is stored on that row, and only there.
        expect(await mirror(PAID)).toMatchObject({
          seatItemId: "si_made_by_sync",
        })
        expect(await mirror(UNPAID)).toMatchObject({
          seatItemId: `si_seat_${UNPAID}`,
        })
      })

      it("4. keeps the mark, and takes Stripe's metadata, on the events that follow", async () => {
        const before = (await mirror(PAID))?.metadata?.seatSyncGeneration
        // Stripe reports Eleva's own seat item back.
        await deliver(
          "customer.subscription.updated",
          240,
          subscription(PAID, "active", {
            seatItem: true,
            metadata: { note: "from Stripe" },
          })
        )
        const row = await mirror(PAID)
        expect(row).toMatchObject({ seatItemId: `si_seat_${PAID}` })
        expect(row?.metadata).toMatchObject({
          note: "from Stripe",
          seatSyncPending: true,
          // Not marked again: the plan stayed current and has its seat item.
          seatSyncGeneration: before,
        })
      })

      it("5. changes nothing when an event arrives twice, or late", async () => {
        const before = await mirror(PAID)
        await deliver(
          "customer.subscription.updated",
          240,
          subscription(PAID, "active", {
            seatItem: true,
            metadata: { note: "from Stripe" },
          })
        )
        // An older event (the unpaid state) arriving after the newer one.
        const late = await deliver(
          "customer.subscription.created",
          120,
          subscription(PAID, "incomplete")
        )
        expect(late).toMatchObject({ kind: "ignored" })
        const after = await mirror(PAID)
        expect(after).toMatchObject({
          status: "active",
          seatItemId: `si_seat_${PAID}`,
        })
        expect(after?.metadata).toEqual(before?.metadata)
        const rows = await db()
          .select({ id: main.billingSubscriptions.id })
          .from(main.billingSubscriptions)
          .where(eq(main.billingSubscriptions.orgId, clinicId))
        expect(rows).toHaveLength(2)
      })

      it("6. sets the known seat item to the count, and nothing once the plan has ended", async () => {
        const { gateway, calls } = recordingGateway()
        await syncSeatQuantityAudited(clinicId, null, { gateway })
        expect(calls).toEqual([`set si_seat_${PAID} 1`])

        await deliver(
          "customer.subscription.deleted",
          300,
          subscription(PAID, "canceled", { seatItem: true })
        )
        calls.length = 0
        const result = await syncSeatQuantityAudited(clinicId, null, {
          gateway,
        })
        expect(result).toEqual({
          synced: false,
          reason: "no_current_subscription",
        })
        expect(calls).toEqual([])
      })
    }
  )
