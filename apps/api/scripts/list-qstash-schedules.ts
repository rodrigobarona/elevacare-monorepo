import { Client } from "@upstash/qstash"

async function main() {
  const token = process.env.QSTASH_TOKEN
  const baseUrl = process.env.QSTASH_URL
  if (!token) throw new Error("QSTASH_TOKEN not set")

  const client = new Client({ baseUrl, token })

  console.log("=== QStash Schedules ===")
  const schedules = await client.schedules.list()
  for (const s of schedules) {
    console.log(`\nSchedule: ${s.scheduleId}`)
    console.log(`  Destination: ${s.destination}`)
    console.log(`  Cron:        ${s.cron}`)
    console.log(`  Retries:     ${s.retries}`)
    console.log(`  Created:     ${new Date(s.createdAt).toISOString()}`)
    if (s.method) console.log(`  Method:      ${s.method}`)
    if (s.header)
      console.log(`  Headers:     ${Object.keys(s.header).join(", ")}`)
    if (s.paused) console.log(`  PAUSED:      ${s.paused}`)
  }
  console.log(`\nTotal schedules: ${schedules.length}`)

  // Look for the two we expect
  const expectedDestinations = [
    "https://api.eleva.care/workflows/audit-outbox-drainer",
    "https://api.eleva.care/workflows/stripe-stuck-events",
  ]
  console.log("\n=== Expected schedules check ===")
  for (const dest of expectedDestinations) {
    const match = schedules.find((s) => s.destination === dest)
    if (match) {
      console.log(
        `  PRESENT: ${dest} (cron=${match.cron}, paused=${match.paused ?? false})`
      )
    } else {
      console.log(`  MISSING: ${dest}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
