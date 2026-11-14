import { assertNotProductionDatabase } from "@eleva/config/env"
import { seedDemo } from "./demo"
import { seedExpertCategories } from "./expert-categories"
import { seedDemoMemberSessions } from "./demo-member-sessions"
import { seedOfferFixtures } from "./offer-fixtures"

/**
 * Demo seed for local and dev databases only. It refuses production and any
 * DATABASE_URL whose Neon endpoint it cannot read (a local Postgres URL
 * included); point it at a Neon dev branch.
 */
async function main() {
  assertNotProductionDatabase(process.env.DATABASE_URL ?? "", "The demo seed")
  // Fixtures list experts under categories, so the taxonomy comes first.
  await seedExpertCategories()
  const results = await seedDemo()
  console.log("[seed:demo] upserted personas:")
  for (const r of results) {
    console.log(`  ${r.email} -> user=${r.userId} org=${r.orgId}`)
  }
  await seedOfferFixtures()
  console.log(
    "[seed:demo] offer fixtures ready (anaquick, fisiomota + demo experts)"
  )
  await seedDemoMemberSessions()
  console.log("[seed:demo] demo member sessions ready")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
