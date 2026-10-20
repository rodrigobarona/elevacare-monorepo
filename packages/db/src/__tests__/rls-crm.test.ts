import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { Pool } from "@neondatabase/serverless"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "../client"
import { withOrgContext } from "../context"
import { organization, user } from "../schema/auth/index"
import { crmContacts, crmFollowUps } from "../schema/main/index"
import { provisionRlsTestRole } from "./rls-test-role"

const enabled = process.env.ELEVA_RLS_INTEGRATION === "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

describe.skipIf(!enabled || !databaseUrl)("rls-crm", () => {
  const orgA = randomUUID()
  const orgB = randomUUID()
  const expert = randomUUID()
  const member = randomUUID()
  const contactA = randomUUID()

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
        [expert, member].map((id) => ({
          id,
          name: `RLS ${id.slice(0, 6)}`,
          email: `rls-crm-${id}@example.test`,
        }))
      )
    await db()
      .insert(organization)
      .values([
        {
          id: orgA,
          name: "RLS crm A",
          slug: `rls-crm-a-${orgA}`,
          type: "expert",
        },
        {
          id: orgB,
          name: "RLS crm B",
          slug: `rls-crm-b-${orgB}`,
          type: "expert",
        },
      ])
    await withOrgContext(orgA, async (tx) => {
      await tx.insert(crmContacts).values({
        id: contactA,
        orgId: orgA,
        memberUserId: member,
        lifecycleStage: "active",
        createdBy: expert,
      })
      await tx.insert(crmFollowUps).values({
        orgId: orgA,
        contactId: contactA,
        dueAt: new Date(Date.now() + 86_400_000),
        kind: "call",
        createdBy: expert,
      })
    })
  }, 30_000)

  afterAll(async () => {
    await db()
      .delete(organization)
      .where(inArray(organization.id, [orgA, orgB]))
    await db()
      .delete(user)
      .where(inArray(user.id, [expert, member]))
  })

  it("hides another org's contacts and follow-ups", async () => {
    const own = await withOrgContext(orgA, (tx) =>
      tx.select({ id: crmContacts.id }).from(crmContacts)
    )
    expect(own.map((row) => row.id)).toEqual([contactA])

    const [contacts, followUps] = await withOrgContext(orgB, (tx) =>
      Promise.all([
        tx
          .select({ id: crmContacts.id })
          .from(crmContacts)
          .where(eq(crmContacts.id, contactA)),
        tx
          .select({ id: crmFollowUps.id })
          .from(crmFollowUps)
          .where(eq(crmFollowUps.contactId, contactA)),
      ])
    )
    expect(contacts).toHaveLength(0)
    expect(followUps).toHaveLength(0)
  })

  it("refuses writes into another org", async () => {
    await expect(
      withOrgContext(orgB, (tx) =>
        tx.insert(crmContacts).values({
          orgId: orgA,
          name: "Cross-tenant lead",
        })
      )
    ).rejects.toThrow()

    const updated = await withOrgContext(orgB, (tx) =>
      tx
        .update(crmContacts)
        .set({ lifecycleStage: "churned" })
        .where(eq(crmContacts.id, contactA))
        .returning({ id: crmContacts.id })
    )
    expect(updated).toHaveLength(0)
  })

  it("deleting the member removes their contact and its follow-ups", async () => {
    await db().delete(user).where(eq(user.id, member))
    const left = await withOrgContext(orgA, (tx) =>
      Promise.all([
        tx
          .select({ id: crmContacts.id })
          .from(crmContacts)
          .where(eq(crmContacts.id, contactA)),
        tx
          .select({ id: crmFollowUps.id })
          .from(crmFollowUps)
          .where(eq(crmFollowUps.contactId, contactA)),
      ])
    )
    expect(left[0]).toHaveLength(0)
    expect(left[1]).toHaveLength(0)
  })
})
