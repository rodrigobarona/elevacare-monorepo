import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { Pool } from "@neondatabase/serverless"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { withOrgContext } from "../context"
import { orgDataKeys } from "../schema/main/org-data-keys"
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
    await withOrgContext(orgA, async (tx) => {
      await tx.delete(orgDataKeys).where(eq(orgDataKeys.orgId, orgA))
    })
    await withOrgContext(orgB, async (tx) => {
      await tx.delete(orgDataKeys).where(eq(orgDataKeys.orgId, orgB))
    })
  })

  it("cross-org read returns zero rows under eleva.org_id", async () => {
    await withOrgContext(orgA, async (tx) => {
      await tx.insert(orgDataKeys).values({
        orgId: orgA,
        keyVersion: 1,
        kekVersion: "1",
        wrappedDek: "rls-iso-a",
      })
    })
    await withOrgContext(orgB, async (tx) => {
      await tx.insert(orgDataKeys).values({
        orgId: orgB,
        keyVersion: 1,
        kekVersion: "1",
        wrappedDek: "rls-iso-b",
      })
    })

    const visible = await withOrgContext(orgA, async (tx) => {
      return tx
        .select({ orgId: orgDataKeys.orgId })
        .from(orgDataKeys)
        .where(inArray(orgDataKeys.orgId, [orgA, orgB]))
    })
    expect(visible).toHaveLength(1)
    expect(visible[0]?.orgId).toBe(orgA)

    const other = await withOrgContext(orgB, async (tx) => {
      return tx
        .select({ orgId: orgDataKeys.orgId })
        .from(orgDataKeys)
        .where(eq(orgDataKeys.orgId, orgA))
    })
    expect(other).toHaveLength(0)
  })
})
