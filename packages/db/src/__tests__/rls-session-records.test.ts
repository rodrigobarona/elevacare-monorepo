import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { Pool } from "@neondatabase/serverless"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "../client"
import {
  withOrgAndUserContext,
  withOrgContext,
  withUserContext,
} from "../context"
import { organization, user } from "../schema/auth/index"
import {
  bookings,
  eventTypes,
  expertProfiles,
  records,
  sessionDocuments,
  sessionParticipants,
} from "../schema/main/index"
import { provisionRlsTestRole } from "./rls-test-role"

const enabled = process.env.ELEVA_RLS_INTEGRATION === "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

/**
 * AUD-041: live isolation for Phase 09/10 clinical tables. Fixtures are
 * written as the owner (BYPASSRLS); every assertion runs as the
 * NOBYPASSRLS test role through the production context helpers.
 */
describe.skipIf(!enabled || !databaseUrl)("rls session records", () => {
  const orgA = randomUUID()
  const orgB = randomUUID()
  const expertA = randomUUID()
  const colleagueA = randomUUID()
  const expertB = randomUUID()
  const member = randomUUID()
  const otherMember = randomUUID()
  const profileA = randomUUID()
  const eventTypeA = randomUUID()
  const bookingA = randomUUID()
  const recordId = randomUUID()
  const sharedDocId = randomUUID()
  const expertOnlyDocId = randomUUID()
  const participantId = randomUUID()
  const colleagueRecordId = randomUUID()
  const colleagueDocId = randomUUID()
  const docIds = [sharedDocId, expertOnlyDocId, colleagueDocId]

  const doc = (id: string, scope: "shared" | "expert_only") => ({
    id,
    orgId: orgA,
    bookingId: bookingA,
    memberUserId: member,
    blobPathname: `rls/${id}`,
    blobUrl: `https://blob.test/rls/${id}`,
    mime: "application/pdf",
    sizeBytes: 1,
    metadataEncrypted: "rls-meta",
    scope,
  })
  const users = [expertA, colleagueA, expertB, member, otherMember]

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
          email: `rls-rec-${id}@example.test`,
        }))
      )
    await db()
      .insert(organization)
      .values([
        {
          id: orgA,
          name: "RLS rec A",
          slug: `rls-rec-a-${orgA}`,
          type: "expert",
        },
        {
          id: orgB,
          name: "RLS rec B",
          slug: `rls-rec-b-${orgB}`,
          type: "expert",
        },
      ])
    // Tenant rows go through the production context helpers, so the insert
    // policies are exercised too. Only auth tables are written as owner.
    await withOrgContext(orgA, async (tx) => {
      await tx.insert(expertProfiles).values({
        id: profileA,
        orgId: orgA,
        userId: expertA,
        username: `rls${orgA.slice(0, 8)}`,
        displayName: "RLS Expert A",
      })
      await tx.insert(eventTypes).values({
        id: eventTypeA,
        orgId: orgA,
        expertProfileId: profileA,
        slug: "rls-visit",
        title: { en: "RLS visit" },
      })
      const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await tx.insert(bookings).values({
        id: bookingA,
        orgId: orgA,
        eventTypeId: eventTypeA,
        expertProfileId: profileA,
        expertUserId: expertA,
        memberUserId: member,
        priceCents: 0,
        priceAmount: 0,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        timezone: "Europe/Lisbon",
        sessionMode: "online",
        status: "confirmed",
      })
      await tx.insert(sessionParticipants).values({
        id: participantId,
        orgId: orgA,
        bookingId: bookingA,
        userId: colleagueA,
        role: "delegate",
        addedBy: expertA,
      })
    })
    await withOrgAndUserContext(orgA, expertA, async (tx) => {
      await tx.insert(records).values({
        id: recordId,
        orgId: orgA,
        bookingId: bookingA,
        memberUserId: member,
        kind: "report",
        titleEncrypted: "rls-title",
        bodyEncrypted: "rls-body",
        createdBy: expertA,
      })
      await tx.insert(sessionDocuments).values({
        ...doc(expertOnlyDocId, "expert_only"),
        uploadedBy: expertA,
      })
    })
    await withOrgAndUserContext(orgA, colleagueA, async (tx) => {
      await tx.insert(records).values({
        id: colleagueRecordId,
        orgId: orgA,
        bookingId: bookingA,
        memberUserId: member,
        kind: "note",
        titleEncrypted: "rls-title",
        bodyEncrypted: "rls-body",
        createdBy: colleagueA,
      })
      await tx.insert(sessionDocuments).values({
        ...doc(colleagueDocId, "expert_only"),
        uploadedBy: colleagueA,
      })
    })
    await withOrgAndUserContext(orgA, member, (tx) =>
      tx
        .insert(sessionDocuments)
        .values({ ...doc(sharedDocId, "shared"), uploadedBy: member })
    )
  }, 60_000)

  afterAll(async () => {
    await db()
      .delete(organization)
      .where(inArray(organization.id, [orgA, orgB]))
    await db().delete(user).where(inArray(user.id, users))
  }, 60_000)

  const readRecord = (orgId: string, userId: string, id = recordId) =>
    withOrgAndUserContext(orgId, userId, (tx) =>
      tx.select({ id: records.id }).from(records).where(eq(records.id, id))
    )

  it("records: author only; other experts and orgs see nothing", async () => {
    expect(await readRecord(orgA, expertA)).toEqual([{ id: recordId }])
    expect(await readRecord(orgA, colleagueA)).toEqual([])
    expect(await readRecord(orgB, expertB)).toEqual([])

    // Author-only even on the booking expert's own booking.
    expect(await readRecord(orgA, colleagueA, colleagueRecordId)).toEqual([
      { id: colleagueRecordId },
    ])
    expect(await readRecord(orgA, expertA, colleagueRecordId)).toEqual([])

    const edited = await withOrgAndUserContext(orgA, colleagueA, (tx) =>
      tx
        .update(records)
        .set({ bodyEncrypted: "tampered" })
        .where(eq(records.id, recordId))
        .returning({ id: records.id })
    )
    expect(edited).toEqual([])
  })

  it("records: the member reads only after publish", async () => {
    const memberRead = (userId: string) =>
      withUserContext(userId, (tx) =>
        tx
          .select({ id: records.id })
          .from(records)
          .where(eq(records.id, recordId))
      )
    expect(await memberRead(member)).toEqual([])

    const published = await withOrgAndUserContext(orgA, expertA, (tx) =>
      tx
        .update(records)
        .set({ publishedAt: new Date() })
        .where(eq(records.id, recordId))
        .returning({ id: records.id })
    )
    expect(published).toEqual([{ id: recordId }])

    expect(await memberRead(member)).toEqual([{ id: recordId }])
    expect(await memberRead(otherMember)).toEqual([])
  })

  it("session documents: uploader, booking expert and shared member only", async () => {
    const orgRead = (orgId: string, userId: string) =>
      withOrgAndUserContext(orgId, userId, (tx) =>
        tx
          .select({ id: sessionDocuments.id })
          .from(sessionDocuments)
          .where(inArray(sessionDocuments.id, docIds))
      )
    const memberRead = (userId: string) =>
      withUserContext(userId, (tx) =>
        tx
          .select({ id: sessionDocuments.id })
          .from(sessionDocuments)
          .where(inArray(sessionDocuments.id, docIds))
      )

    const ids = async (rows: Promise<{ id: string }[]>) =>
      (await rows).map((row) => row.id).sort()

    // The booking expert reads every document on the booking.
    expect(await ids(orgRead(orgA, expertA))).toEqual([...docIds].sort())
    // A colleague reads only what they uploaded.
    expect(await ids(orgRead(orgA, colleagueA))).toEqual([colleagueDocId])
    expect(await orgRead(orgB, expertB)).toEqual([])
    expect(await memberRead(member)).toEqual([{ id: sharedDocId }])
    expect(await memberRead(otherMember)).toEqual([])
  })

  it("session participants: same org or the participant only", async () => {
    const select = (tx: Parameters<Parameters<typeof withOrgContext>[1]>[0]) =>
      tx
        .select({ id: sessionParticipants.id })
        .from(sessionParticipants)
        .where(eq(sessionParticipants.id, participantId))

    expect(await withOrgContext(orgA, select)).toEqual([{ id: participantId }])
    expect(await withOrgContext(orgB, select)).toEqual([])
    expect(await withUserContext(colleagueA, select)).toEqual([
      { id: participantId },
    ])
    expect(await withUserContext(otherMember, select)).toEqual([])

    await expect(
      withOrgContext(orgB, (tx) =>
        tx.insert(sessionParticipants).values({
          orgId: orgA,
          bookingId: bookingA,
          userId: otherMember,
          role: "delegate",
          addedBy: expertB,
        })
      )
    ).rejects.toThrow()
  })
})
