import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { Pool } from "@neondatabase/serverless"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "../client"
import {
  withOrgAndUserContext,
  withOrgContext,
  withPlatformAdminContext,
  withUserContext,
} from "../context"
import { organization, user } from "../schema/auth/index"
import {
  bookings,
  eventTypes,
  expertProfiles,
  recordAccessOptouts,
  records,
} from "../schema/main/index"
import { provisionRlsTestRole } from "./rls-test-role"

const enabled = process.env.ELEVA_RLS_INTEGRATION === "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

/**
 * Phase 10 acceptance: who can read clinical `records` in a clinic org.
 * Four viewers: the author, a clinic peer (shared on / off), the member
 * (opt-out), and platform staff. Fixtures are written through the production
 * context helpers; assertions run as the NOBYPASSRLS test role.
 */
describe.skipIf(!enabled || !databaseUrl)(
  "rls clinic shared records",
  { timeout: 30_000 },
  () => {
    const clinicOrg = randomUUID()
    const otherOrg = randomUUID()
    const author = randomUUID()
    const peer = randomUUID()
    const outsider = randomUUID()
    const member = randomUUID()
    const optOutMember = randomUUID()
    const authorProfile = randomUUID()
    const peerProfile = randomUUID()
    const outsiderProfile = randomUUID()
    const eventType = randomUUID()
    const bookingShared = randomUUID()
    const bookingOptOut = randomUUID()
    const reportId = randomUUID()
    const internalId = randomUUID()
    const optOutReportId = randomUUID()
    const users = [author, peer, outsider, member, optOutMember]

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
            name: `RLS ${id.slice(0, 6)}`,
            email: `rls-clinic-${id}@example.test`,
          }))
        )
      await db()
        .insert(organization)
        .values([
          {
            id: clinicOrg,
            name: "RLS clinic",
            slug: `rls-clinic-${clinicOrg}`,
            type: "expert",
          },
          {
            id: otherOrg,
            name: "RLS other",
            slug: `rls-clinic-other-${otherOrg}`,
            type: "expert",
          },
        ])

      await withOrgContext(clinicOrg, async (tx) => {
        await tx.insert(expertProfiles).values([
          {
            id: authorProfile,
            orgId: clinicOrg,
            userId: author,
            username: `rlsa${clinicOrg.slice(0, 8)}`,
            displayName: "RLS Author",
          },
          {
            id: peerProfile,
            orgId: clinicOrg,
            userId: peer,
            username: `rlsp${clinicOrg.slice(0, 8)}`,
            displayName: "RLS Peer",
          },
        ])
        await tx.insert(eventTypes).values({
          id: eventType,
          orgId: clinicOrg,
          expertProfileId: authorProfile,
          slug: "rls-clinic-visit",
          title: { en: "RLS clinic visit" },
        })
        const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
        for (const [id, memberUserId] of [
          [bookingShared, member],
          [bookingOptOut, optOutMember],
        ] as const) {
          await tx.insert(bookings).values({
            id,
            orgId: clinicOrg,
            eventTypeId: eventType,
            expertProfileId: authorProfile,
            expertUserId: author,
            memberUserId,
            priceCents: 0,
            priceAmount: 0,
            startsAt,
            endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
            timezone: "Europe/Lisbon",
            sessionMode: "online",
            status: "confirmed",
          })
        }
      })
      await withOrgContext(otherOrg, (tx) =>
        tx.insert(expertProfiles).values({
          id: outsiderProfile,
          orgId: otherOrg,
          userId: outsider,
          username: `rlso${otherOrg.slice(0, 8)}`,
          displayName: "RLS Outsider",
        })
      )
      await withOrgAndUserContext(clinicOrg, author, async (tx) => {
        const base = {
          orgId: clinicOrg,
          titleEncrypted: "rls-title",
          bodyEncrypted: "rls-body",
          createdBy: author,
        }
        await tx.insert(records).values([
          {
            ...base,
            id: reportId,
            bookingId: bookingShared,
            memberUserId: member,
            kind: "report",
          },
          {
            ...base,
            id: internalId,
            bookingId: bookingShared,
            memberUserId: member,
            kind: "internal_report",
          },
          {
            ...base,
            id: optOutReportId,
            bookingId: bookingOptOut,
            memberUserId: optOutMember,
            kind: "report",
          },
        ])
      })
    }, 60_000)

    afterAll(async () => {
      await db()
        .delete(organization)
        .where(inArray(organization.id, [clinicOrg, otherOrg]))
      await db().delete(user).where(inArray(user.id, users))
    }, 60_000)

    const setShared = (value: boolean) =>
      db()
        .update(organization)
        .set({ clinicSharedRecords: value })
        .where(eq(organization.id, clinicOrg))

    const visibleTo = async (orgId: string, userId: string) =>
      (
        await withOrgAndUserContext(orgId, userId, (tx) =>
          tx
            .select({ id: records.id })
            .from(records)
            .where(inArray(records.id, [reportId, internalId, optOutReportId]))
        )
      )
        .map((row) => row.id)
        .sort()

    it("author: reads every record on their own booking, shared flag irrelevant", async () => {
      await setShared(false)
      expect(await visibleTo(clinicOrg, author)).toEqual(
        [reportId, internalId, optOutReportId].sort()
      )
    })

    it("clinic peer: sees nothing while clinic_shared_records is off (D-11 default)", async () => {
      await setShared(false)
      expect(await visibleTo(clinicOrg, peer)).toEqual([])
    })

    it("clinic peer: shared on exposes reports but never internal_report, and honours opt-out", async () => {
      await setShared(true)
      try {
        expect(await visibleTo(clinicOrg, peer)).toEqual(
          [reportId, optOutReportId].sort()
        )

        await withUserContext(optOutMember, (tx) =>
          tx
            .insert(recordAccessOptouts)
            .values({ memberUserId: optOutMember, orgId: clinicOrg })
        )
        expect(await visibleTo(clinicOrg, peer)).toEqual([reportId])
        // The author is unaffected by the member's opt-out.
        expect(await visibleTo(clinicOrg, author)).toContain(optOutReportId)

        // Opt-out is revocable.
        await withUserContext(optOutMember, (tx) =>
          tx
            .delete(recordAccessOptouts)
            .where(eq(recordAccessOptouts.memberUserId, optOutMember))
        )
        expect(await visibleTo(clinicOrg, peer)).toEqual(
          [reportId, optOutReportId].sort()
        )
      } finally {
        await setShared(false)
      }
    })

    it("clinic peer cannot edit a colleague's record even when sharing is on", async () => {
      await setShared(true)
      try {
        const updated = await withOrgAndUserContext(clinicOrg, peer, (tx) =>
          tx
            .update(records)
            .set({ bodyEncrypted: "tampered" })
            .where(eq(records.id, reportId))
            .returning({ id: records.id })
        )
        expect(updated).toEqual([])
      } finally {
        await setShared(false)
      }
    })

    it("an expert from another org sees nothing, even with sharing on", async () => {
      await setShared(true)
      try {
        // Spoofing the clinic org id without a clinic expert profile fails.
        expect(await visibleTo(clinicOrg, outsider)).toEqual([])
        expect(await visibleTo(otherOrg, outsider)).toEqual([])
      } finally {
        await setShared(false)
      }
    })

    it("platform staff context has no read path to clinical records", async () => {
      await setShared(true)
      try {
        const rows = await withPlatformAdminContext((tx) =>
          tx
            .select({ id: records.id })
            .from(records)
            .where(inArray(records.id, [reportId, internalId, optOutReportId]))
        )
        expect(rows).toEqual([])
      } finally {
        await setShared(false)
      }
    })

    it("member: reads only their own published records", async () => {
      const read = (userId: string) =>
        withUserContext(userId, (tx) =>
          tx
            .select({ id: records.id })
            .from(records)
            .where(inArray(records.id, [reportId, internalId, optOutReportId]))
        )
      expect(await read(member)).toEqual([])

      await withOrgAndUserContext(clinicOrg, author, (tx) =>
        tx
          .update(records)
          .set({ publishedAt: new Date() })
          .where(eq(records.id, reportId))
      )
      expect(await read(member)).toEqual([{ id: reportId }])
      // Another member's record and the unpublished internal report stay hidden.
      expect(await read(optOutMember)).toEqual([])
    })
  }
)
