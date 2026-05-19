import { neon } from "@neondatabase/serverless"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL not set")
  const sql = neon(url)

  console.log("=== MIGRATIONS APPLIED (drizzle.__drizzle_migrations) ===")
  const migrations = await sql.query(
    `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 10`
  )
  console.log(JSON.stringify(migrations, null, 2))

  console.log("\n=== ENUM stripe_webhook_event_status ===")
  const enumValues = await sql.query(
    `SELECT enumlabel FROM pg_enum
     WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'stripe_webhook_event_status')
     ORDER BY enumsortorder`
  )
  console.log(
    (enumValues as Array<{ enumlabel: string }>)
      .map((r) => r.enumlabel)
      .join(", ")
  )

  console.log("\n=== COLUMNS billing_subscriptions ===")
  const billSubsCols = await sql.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'billing_subscriptions'
     ORDER BY ordinal_position`
  )
  console.log(
    (billSubsCols as Array<{ column_name: string; data_type: string }>)
      .map((r) => `  ${r.column_name} (${r.data_type})`)
      .join("\n")
  )

  console.log("\n=== COLUMNS stripe_webhook_events ===")
  const eventCols = await sql.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'stripe_webhook_events'
     ORDER BY ordinal_position`
  )
  console.log(
    (eventCols as Array<{ column_name: string; data_type: string }>)
      .map((r) => `  ${r.column_name} (${r.data_type})`)
      .join("\n")
  )

  console.log("\n=== RLS STATUS on new tables ===")
  const rls = await sql.query(
    `SELECT tablename, rowsecurity
     FROM pg_tables
     WHERE tablename IN ('billing_customers', 'billing_subscriptions', 'stripe_webhook_events')
     ORDER BY tablename`
  )
  console.log(JSON.stringify(rls, null, 2))

  console.log(
    "\n=== FOREIGN KEYS on stripe_webhook_events (verifying 0018) ==="
  )
  const fks = await sql.query(
    `SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
     FROM information_schema.table_constraints AS tc
     JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_name = kcu.constraint_name
     JOIN information_schema.constraint_column_usage AS ccu
       ON ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_name = 'stripe_webhook_events'`
  )
  console.log(JSON.stringify(fks, null, 2))

  console.log("\n=== HEALTH SNAPSHOT — mirror + event tables ===")
  const health = await sql.query(`
    SELECT
      (SELECT COUNT(*) FROM billing_customers)                                                AS customers,
      (SELECT COUNT(*) FROM billing_customers WHERE stripe_customer_id IS NULL)               AS unlinked_customers,
      (SELECT COUNT(*) FROM billing_subscriptions)                                            AS subs,
      (SELECT COUNT(*) FROM stripe_webhook_events)                                            AS events_total,
      (SELECT COUNT(*) FROM stripe_webhook_events WHERE status = 'received')                  AS events_received,
      (SELECT COUNT(*) FROM stripe_webhook_events WHERE status = 'processing')                AS events_processing,
      (SELECT COUNT(*) FROM stripe_webhook_events WHERE status = 'processed')                 AS events_processed,
      (SELECT COUNT(*) FROM stripe_webhook_events WHERE status = 'failed')                    AS events_failed_retryable,
      (SELECT COUNT(*) FROM stripe_webhook_events WHERE status = 'failed_terminal')           AS events_failed_terminal,
      (SELECT COUNT(*) FROM stripe_webhook_events WHERE status = 'ignored')                   AS events_ignored,
      (SELECT COUNT(*) FROM stripe_webhook_events WHERE status IN ('received','processing')
                                                  AND received_at < now() - interval '15 min') AS events_stuck
  `)
  console.log(JSON.stringify(health, null, 2))

  console.log("\n=== AUDIT OUTBOX LAG ===")
  const outboxLag = await sql.query(`
    SELECT
      (SELECT COUNT(*) FROM audit_outbox)                                  AS total,
      (SELECT COUNT(*) FROM audit_outbox WHERE status = 'pending')         AS pending,
      (SELECT COUNT(*) FROM audit_outbox WHERE status = 'shipped')         AS shipped,
      (SELECT COUNT(*) FROM audit_outbox WHERE status = 'failed')          AS failed,
      (SELECT MIN(created_at) FROM audit_outbox WHERE status = 'pending')  AS oldest_pending
  `)
  console.log(JSON.stringify(outboxLag, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
