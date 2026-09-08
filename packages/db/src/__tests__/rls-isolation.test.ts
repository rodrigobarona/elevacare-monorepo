import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { Pool } from "@neondatabase/serverless"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { withOrgContext, withPlatformAdminContext } from "../context"
import { organizations } from "../schema/main/organizations"
import { provisionRlsTestRole } from "./rls-test-role"

const enabled = process.env.ELEVA_RLS_INTEGRATION === "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

describe.skipIf(!enabled || !databaseUrl)("rls-isolation", () => {
  const orgA = randomUUID()
  const orgB = randomUUID()

  beforeAll(async () => {
    const pool = new Pool({ connectionString: databaseUrl })
    const client = await pool.connect()
    try {
      await provisionRlsTestRole(client)
    } finally {
      client.release()
      await pool.end()
    }
  })

  afterAll(async () => {
    await withPlatformAdminContext(async (tx) => {
      await tx
        .delete(organizations)
        .where(inArray(organizations.id, [orgA, orgB]))
    })
  })

  it("cross-org read returns zero rows under eleva.org_id", async () => {
    await withPlatformAdminContext(async (tx) => {
      await tx.insert(organizations).values([
        { id: orgA, workosOrgId: `rls-iso-a-${orgA}`, type: "personal" },
        { id: orgB, workosOrgId: `rls-iso-b-${orgB}`, type: "personal" },
      ])
    })

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
