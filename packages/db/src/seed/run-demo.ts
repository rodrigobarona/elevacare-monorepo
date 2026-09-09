import { seedDemo } from "./demo"
import { seedOfferFixtures } from "./offer-fixtures"

async function main() {
  const results = await seedDemo()
  console.log("[seed:demo] upserted personas:")
  for (const r of results) {
    console.log(`  ${r.email} -> user=${r.userId} org=${r.orgId}`)
  }
  await seedOfferFixtures()
  console.log("[seed:demo] offer fixtures ready (anaquick, fisiomota)")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
