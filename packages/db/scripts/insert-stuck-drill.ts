import { neon } from "@neondatabase/serverless"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL not set")
  const sql = neon(url)

  console.log("=== Step 1: Insert synthetic stuck row ===")
  const drillEventId = `evt_drill_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  await sql.query(
    `INSERT INTO stripe_webhook_events
       (event_id, event_type, livemode, status, received_at, last_attempt_at, event_created_at, attempts)
     VALUES
       ($1, 'customer.subscription.updated', false, 'processing',
        now() - interval '20 minutes',
        now() - interval '15 minutes',
        now() - interval '20 minutes',
        1)`,
    [drillEventId]
  )
  console.log(
    `  Inserted: ${drillEventId} (status=processing, received 20 min ago)`
  )

  console.log("\n=== Step 2: Verify it shows up as stuck ===")
  const stuck = await sql.query(
    `SELECT event_id, event_type, status, received_at, last_attempt_at, attempts
     FROM stripe_webhook_events
     WHERE event_id = $1`,
    [drillEventId]
  )
  console.log(JSON.stringify(stuck, null, 2))

  console.log("\n=== Step 3: Persist event ID for the next phase ===")
  console.log(`DRILL_EVENT_ID=${drillEventId}`)
  console.log("(Use this to clean up after Sentry verification)")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
