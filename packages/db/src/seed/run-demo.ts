/* eslint-disable no-console */
import { seedDemo } from "./demo"

async function main() {
  const results = await seedDemo()
  console.log("[seed:demo] upserted personas:")
  for (const r of results) {
    console.log(`  ${r.email} -> user=${r.userId} org=${r.orgId}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
