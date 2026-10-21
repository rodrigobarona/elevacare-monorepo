import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { Pool } from "@neondatabase/serverless"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "../client"
import { withOrgContext, withPlatformAdminContext } from "../context"
import { organization, user } from "../schema/auth/index"
import {
  bookingPayments,
  bookings,
  eventTypes,
  expertProfiles,
} from "../schema/main/index"
import { bookingRefunds, payoutStates } from "../schema/main/payouts"
import { provisionRlsTestRole } from "./rls-test-role"

const enabled = process.env.ELEVA_RLS_INTEGRATION === "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

/** AUD-014: live tenant isolation on Phase 06 money tables. */
describe.skipIf(!enabled || !databaseUrl)(
  "rls money tables",
  { timeout: 60_000 },
  () => {
    const orgA = randomUUID()
    const orgB = randomUUID()
    const expertA = randomUUID()
    const expertB = randomUUID()
    const profileA = randomUUID()
    const profileB = randomUUID()
    const eventTypeA = randomUUID()
    const eventTypeB = randomUUID()
    const bookingA = randomUUID()
    const paymentA = randomUUID()
    const payoutA = randomUUID()
    const refundA = randomUUID()
    const users = [expertA, expertB]

    beforeAll(async () => {
      const pool = new Pool({ connectionString: databaseUrl })
      const client = await pool.connect()
      try {
        await provisionRlsTestRole(client)
      } finally {
        client.release()
        await pool.end()
      }

      await db()
        .insert(user)
        .values(
          users.map((id) => ({
            id,
            name: `RLS money ${id.slice(0, 6)}`,
            email: `rls-money-${id}@example.test`,
          }))
        )
      await db()
        .insert(organization)
        .values([
          {
            id: orgA,
            name: "RLS money A",
            slug: `rls-money-a-${orgA}`,
            type: "expert",
          },
          {
            id: orgB,
            name: "RLS money B",
            slug: `rls-money-b-${orgB}`,
            type: "expert",
          },
        ])

      const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

      await withOrgContext(orgA, async (tx) => {
        await tx.insert(expertProfiles).values({
          id: profileA,
          orgId: orgA,
          userId: expertA,
          username: `rlsm${orgA.slice(0, 8)}`,
          displayName: "RLS Money A",
        })
        await tx.insert(eventTypes).values({
          id: eventTypeA,
          orgId: orgA,
          expertProfileId: profileA,
          slug: "rls-paid",
          title: { en: "RLS paid visit" },
        })
        await tx.insert(bookings).values({
          id: bookingA,
          orgId: orgA,
          eventTypeId: eventTypeA,
          expertProfileId: profileA,
          expertUserId: expertA,
          priceCents: 6000,
          priceAmount: 6000,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
          timezone: "Europe/Lisbon",
          sessionMode: "online",
          status: "confirmed",
        })
        await tx.insert(bookingPayments).values({
          id: paymentA,
          orgId: orgA,
          bookingId: bookingA,
          status: "succeeded",
          amountCents: 6000,
          stripeIdempotencyKey: `rls-money-${paymentA}`,
          paidAt: new Date(),
        })
        await tx.insert(payoutStates).values({
          id: payoutA,
          orgId: orgA,
          bookingPaymentId: paymentA,
          expertOrgId: orgA,
          destinationOrgId: orgA,
          destinationConnectAccountId: "acct_rls_money_a",
          status: "pending",
          amountCents: 5400,
          eligibleAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        })
        await tx.insert(bookingRefunds).values({
          id: refundA,
          orgId: orgA,
          bookingPaymentId: paymentA,
          amountCents: 1000,
          status: "pending",
          reason: "rls-fixture",
          refundSeq: 1,
          idempotencyKey: `rls-refund-${refundA}`,
        })
      })

      await withOrgContext(orgB, async (tx) => {
        await tx.insert(expertProfiles).values({
          id: profileB,
          orgId: orgB,
          userId: expertB,
          username: `rlsm${orgB.slice(0, 8)}`,
          displayName: "RLS Money B",
        })
        await tx.insert(eventTypes).values({
          id: eventTypeB,
          orgId: orgB,
          expertProfileId: profileB,
          slug: "rls-paid-b",
          title: { en: "RLS paid visit B" },
        })
      })
    })

    afterAll(async () => {
      await db()
        .delete(organization)
        .where(inArray(organization.id, [orgA, orgB]))
      await db().delete(user).where(inArray(user.id, users))
    })

    it("booking_payments: tenant sees only its org", async () => {
      const own = await withOrgContext(orgA, (tx) =>
        tx
          .select({ id: bookingPayments.id })
          .from(bookingPayments)
          .where(eq(bookingPayments.id, paymentA))
      )
      expect(own).toEqual([{ id: paymentA }])

      const other = await withOrgContext(orgB, (tx) =>
        tx
          .select({ id: bookingPayments.id })
          .from(bookingPayments)
          .where(eq(bookingPayments.id, paymentA))
      )
      expect(other).toHaveLength(0)
    })

    it("booking_payments: platform admin can read without org_id", async () => {
      const rows = await withPlatformAdminContext((tx) =>
        tx
          .select({ id: bookingPayments.id, orgId: bookingPayments.orgId })
          .from(bookingPayments)
          .where(eq(bookingPayments.id, paymentA))
      )
      expect(rows).toEqual([{ id: paymentA, orgId: orgA }])
    })

    it("payout_states and booking_refunds: cross-org read is empty", async () => {
      const [payouts, refunds] = await withOrgContext(orgB, (tx) =>
        Promise.all([
          tx
            .select({ id: payoutStates.id })
            .from(payoutStates)
            .where(eq(payoutStates.id, payoutA)),
          tx
            .select({ id: bookingRefunds.id })
            .from(bookingRefunds)
            .where(eq(bookingRefunds.id, refundA)),
        ])
      )
      expect(payouts).toHaveLength(0)
      expect(refunds).toHaveLength(0)
    })

    it("refuses cross-tenant payment insert", async () => {
      await expect(
        withOrgContext(orgB, (tx) =>
          tx.insert(bookingPayments).values({
            orgId: orgA,
            bookingId: bookingA,
            status: "intent_pending",
            amountCents: 1,
            stripeIdempotencyKey: `rls-cross-${randomUUID()}`,
          })
        )
      ).rejects.toThrow()
    })

    it("cross-tenant update touches zero rows", async () => {
      const updated = await withOrgContext(orgB, (tx) =>
        tx
          .update(bookingPayments)
          .set({ refundedCents: 999 })
          .where(eq(bookingPayments.id, paymentA))
          .returning({ id: bookingPayments.id })
      )
      expect(updated).toHaveLength(0)

      const unchanged = await withOrgContext(orgA, (tx) =>
        tx
          .select({ refundedCents: bookingPayments.refundedCents })
          .from(bookingPayments)
          .where(eq(bookingPayments.id, paymentA))
      )
      expect(unchanged[0]?.refundedCents).toBe(0)
    })
  }
)
