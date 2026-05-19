import { neon } from "@neondatabase/serverless"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL not set")
  const sql = neon(url)

  console.log("=== Recent stripe_webhook_events (last 30 min) ===\n")
  const events = await sql.query(`
    SELECT
      event_id,
      event_type,
      status,
      attempts,
      ignore_reason,
      error,
      resolved_org_id,
      received_at,
      processed_at,
      EXTRACT(EPOCH FROM (processed_at - received_at)) * 1000 AS latency_ms
    FROM stripe_webhook_events
    WHERE received_at > now() - interval '30 minutes'
    ORDER BY received_at ASC
  `)
  for (const e of events as Array<Record<string, unknown>>) {
    const lat = e.latency_ms ? `${Math.round(Number(e.latency_ms))}ms` : "n/a"
    const ignore = e.ignore_reason ? ` reason=${e.ignore_reason}` : ""
    const err = e.error ? ` ERR=${e.error}` : ""
    const org = e.resolved_org_id ? ` org=${e.resolved_org_id}` : ""
    console.log(
      `  ${e.event_type.padEnd(50)} ${String(e.status).padEnd(18)} attempts=${e.attempts} latency=${lat}${ignore}${err}${org}`
    )
  }
  console.log(`\nTotal events in window: ${(events as unknown[]).length}`)

  console.log("\n=== Status breakdown ===")
  const breakdown = await sql.query(`
    SELECT status, COUNT(*) AS n
    FROM stripe_webhook_events
    WHERE received_at > now() - interval '30 minutes'
    GROUP BY status
    ORDER BY status
  `)
  for (const row of breakdown as Array<Record<string, unknown>>) {
    console.log(`  ${row.status}: ${row.n}`)
  }

  console.log("\n=== Mirror table state ===")
  const mirrors = await sql.query(`
    SELECT
      (SELECT COUNT(*) FROM billing_customers)     AS customers,
      (SELECT COUNT(*) FROM billing_subscriptions) AS subs
  `)
  console.log(JSON.stringify(mirrors, null, 2))

  console.log("\n=== Outbox state ===")
  const outbox = await sql.query(`
    SELECT
      action, entity, status, COUNT(*) AS n
    FROM audit_outbox
    WHERE created_at > now() - interval '30 minutes'
    GROUP BY action, entity, status
    ORDER BY entity, action, status
  `)
  if ((outbox as unknown[]).length === 0) {
    console.log("  (no audit outbox rows in last 30 min)")
  } else {
    for (const row of outbox as Array<Record<string, unknown>>) {
      console.log(`  ${row.entity}.${row.action} [${row.status}]: ${row.n}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
