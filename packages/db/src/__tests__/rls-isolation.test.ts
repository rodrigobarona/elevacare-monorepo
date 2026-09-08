import { randomUUID } from "node:crypto"
import { Pool } from "@neondatabase/serverless"
import { eq, inArray } from "drizzle-orm"
import { afterAll, describe, expect, it } from "vitest"
import { withOrgContext } from "../context"
import { organizations } from "../schema/main/organizations"

const enabled = process.env.ELEVA_RLS_INTEGRATION === "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

describe.skipIf(!enabled || !databaseUrl)("rls-isolation", () => {
  const pool = new Pool({ connectionString: databaseUrl })
  const orgA = randomUUID()
  const orgB = randomUUID()

  afterAll(async () => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(
        `SELECT set_config('eleva.platform_admin', 'true', true)`
      )
      await client.query(
        `DELETE FROM organizations WHERE id = ANY($1::uuid[])`,
        [[orgA, orgB]]
      )
      await client.query("COMMIT")
    } finally {
      client.release()
      await pool.end()
    }
  })

  it("cross-org read returns zero rows under eleva.org_id", async () => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(
        `SELECT set_config('eleva.platform_admin', 'true', true)`
      )
      await client.query(
        `INSERT INTO organizations (id, workos_org_id, type)
         VALUES ($1, $2, 'personal'), ($3, $4, 'personal')`,
        [orgA, `rls-iso-a-${orgA}`, orgB, `rls-iso-b-${orgB}`]
      )
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw error
    } finally {
      client.release()
    }

    const visible = await withOrgContext(orgA, async (tx) => {
      return tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(inArray(organizations.id, [orgA, orgB]))
    })
    expect(visible).toHaveLength(1)
    expect(visible[0]?.id).toBe(orgA)

    const other = await withOrgContext(orgB, async (tx) => {
      return tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, orgA))
    })
    expect(other).toHaveLength(0)
  })
})
