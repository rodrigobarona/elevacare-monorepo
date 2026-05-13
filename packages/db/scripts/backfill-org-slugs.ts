/**
 * Backfill slugs for existing organizations that don't have one.
 *
 * Fetches the display name from WorkOS for each org, generates a
 * unique slug, and updates the row. Safe to re-run (skips orgs
 * that already have a slug).
 *
 * Usage:
 *   npx tsx packages/db/scripts/backfill-org-slugs.ts
 *
 * Requires:
 *   DATABASE_URL (or DATABASE_URL_UNPOOLED)
 *   WORKOS_API_KEY
 */

import { eq, isNull, inArray } from "drizzle-orm"
import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { WorkOS } from "@workos-inc/node"
import * as schema from "../src/schema/main"
import { generateUniqueOrgSlug } from "@eleva/config/slug"

async function main() {
  const dbUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
  if (!dbUrl) throw new Error("DATABASE_URL is required")

  const apiKey = process.env.WORKOS_API_KEY
  if (!apiKey) throw new Error("WORKOS_API_KEY is required")

  const sql = neon(dbUrl)
  const db = drizzle(sql, { schema })
  const workos = new WorkOS(apiKey)

  const orgs = await db
    .select({
      id: schema.organizations.id,
      workosOrgId: schema.organizations.workosOrgId,
      slug: schema.organizations.slug,
    })
    .from(schema.organizations)
    .where(isNull(schema.organizations.slug))

  console.log(`Found ${orgs.length} organizations without slugs`)

  async function findExistingSlugs(candidates: string[]): Promise<Set<string>> {
    const rows = await db
      .select({ slug: schema.organizations.slug })
      .from(schema.organizations)
      .where(inArray(schema.organizations.slug, candidates))
    return new Set(rows.map((r) => r.slug).filter(Boolean) as string[])
  }

  let updated = 0
  let failed = 0

  for (const org of orgs) {
    try {
      const workosOrg = await workos.organizations.getOrganization(
        org.workosOrgId
      )
      const slug = await generateUniqueOrgSlug(
        workosOrg.name,
        findExistingSlugs
      )

      await db
        .update(schema.organizations)
        .set({ slug, updatedAt: new Date() })
        .where(eq(schema.organizations.id, org.id))

      console.log(`  ${org.id} → ${slug} (from "${workosOrg.name}")`)
      updated++
    } catch (err) {
      console.error(`  FAILED ${org.id} (workos: ${org.workosOrgId}):`, err)
      failed++
    }
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
