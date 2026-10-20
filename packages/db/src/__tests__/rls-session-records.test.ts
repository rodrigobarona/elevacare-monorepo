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
    await db()
      .insert(expertProfiles)
      .values({
        id: profileA,
        orgId: orgA,
        userId: expertA,
        username: `rls${orgA.slice(0, 8)}`,
        displayName: "RLS Expert A",
      })
    await db()
      .insert(eventTypes)
      .values({
        id: eventTypeA,
        orgId: orgA,
        expertProfileId: profileA,
        slug: "rls-visit",
        title: { en: "RLS visit" },
      })
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await db()
      .insert(bookings)
      .values({
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
    await db().insert(records).values({
      id: recordId,
      orgId: orgA,
      bookingId: bookingA,
      memberUserId: member,
      kind: "report",
      titleEncrypted: "rls-title",
      bodyEncrypted: "rls-body",
      createdBy: expertA,
    })
    await db()
      .insert(sessionDocuments)
      .values([
        {
          id: sharedDocId,
          orgId: orgA,
          bookingId: bookingA,
          memberUserId: member,
          blobPathname: `rls/${sharedDocId}`,
          blobUrl: `https://blob.test/rls/${sharedDocId}`,
          mime: "application/pdf",
          sizeBytes: 1,
          metadataEncrypted: "rls-meta",
          scope: "shared",
          uploadedBy: member,
        },
        {
          id: expertOnlyDocId,
          orgId: orgA,
          bookingId: bookingA,
          memberUserId: member,
          blobPathname: `rls/${expertOnlyDocId}`,
          blobUrl: `https://blob.test/rls/${expertOnlyDocId}`,
          mime: "application/pdf",
          sizeBytes: 1,
          metadataEncrypted: "rls-meta",
          scope: "expert_only",
          uploadedBy: expertA,
        },
      ])
    await db().insert(sessionParticipants).values({
      id: participantId,
      orgId: orgA,
      bookingId: bookingA,
      userId: colleagueA,
      role: "delegate",
      addedBy: expertA,
    })
  }, 60_000)

  afterAll(async () => {
    await db()
      .delete(organization)
      .where(inArray(organization.id, [orgA, orgB]))
    await db().delete(user).where(inArray(user.id, users))
  }, 60_000)

  const readRecord = (orgId: string, userId: string) =>
    withOrgAndUserContext(orgId, userId, (tx) =>
      tx
        .select({ id: records.id })
        .from(records)
        .where(eq(records.id, recordId))
    )

  it("records: author only; other experts and orgs see nothing", async () => {
    expect(await readRecord(orgA, expertA)).toEqual([{ id: recordId }])
    expect(await readRecord(orgA, colleagueA)).toEqual([])
    expect(await readRecord(orgB, expertB)).toEqual([])

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

    await db()
      .update(records)
      .set({ publishedAt: new Date() })
      .where(eq(records.id, recordId))

    expect(await memberRead(member)).toEqual([{ id: recordId }])
    expect(await memberRead(otherMember)).toEqual([])
  })

  it("session documents: uploader, booking expert and shared member only", async () => {
    const orgRead = (orgId: string, userId: string) =>
      withOrgAndUserContext(orgId, userId, (tx) =>
        tx
          .select({ id: sessionDocuments.id })
          .from(sessionDocuments)
          .where(inArray(sessionDocuments.id, [sharedDocId, expertOnlyDocId]))
      )
    const memberRead = (userId: string) =>
      withUserContext(userId, (tx) =>
        tx
          .select({ id: sessionDocuments.id })
          .from(sessionDocuments)
          .where(inArray(sessionDocuments.id, [sharedDocId, expertOnlyDocId]))
      )

    const expertRows = (await orgRead(orgA, expertA)).map((r) => r.id).sort()
    expect(expertRows).toEqual([sharedDocId, expertOnlyDocId].sort())
    expect(await orgRead(orgA, colleagueA)).toEqual([])
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
