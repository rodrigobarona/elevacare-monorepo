/**
 * Idempotent recovery script for the stripe_webhook_events state machine
 * migration (0015 + 0016). Re-runnable safely; uses
 * `ALTER ... IF NOT EXISTS` so previously-applied steps are skipped.
 *
 * Why this exists: drizzle-kit `db:push` emits plain
 * `ALTER TYPE ... ADD VALUE 'foo' BEFORE 'bar'` without IF NOT EXISTS.
 * If a prior push half-succeeded (e.g. enum value added but column
 * additions failed), retrying that push fails on
 *   error: enum label "processing" already exists
 * because the diff doesn't account for the partial application.
 *
 * Usage:
 *   pnpm --filter @eleva/db tsx ../../scripts/fix-stripe-event-state-machine.ts
 *
 * Or directly:
 *   tsx --env-file=.env.local scripts/fix-stripe-event-state-machine.ts
 */

import { neon } from "@neondatabase/serverless"

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
  if (!url) {
    console.error("[fix] DATABASE_URL not set")
    process.exit(1)
  }
  const sql = neon(url)

  console.log(
    "[fix] Applying idempotent corrections to stripe_webhook_events..."
  )

  // ALTER TYPE ADD VALUE IF NOT EXISTS is supported on PG 9.6+
  // (Neon serverless is PG 16+). Cannot run inside an explicit
  // transaction with other DDL in some PG versions, so we run
  // each ALTER TYPE on its own.
  const enumStatements = [
    `ALTER TYPE "public"."stripe_webhook_event_status" ADD VALUE IF NOT EXISTS 'processing' BEFORE 'processed'`,
    `ALTER TYPE "public"."stripe_webhook_event_status" ADD VALUE IF NOT EXISTS 'failed_terminal' BEFORE 'ignored'`,
  ]
  for (const stmt of enumStatements) {
    try {
      await sql.query(stmt)
      console.log(`[fix] OK: ${stmt}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[fix] FAILED: ${stmt}\n  ${msg}`)
      throw err
    }
  }

  // ALTER TABLE ADD COLUMN IF NOT EXISTS works fine in a single block.
  // Default values are applied to existing rows on add (PG 11+ does
  // this without a table rewrite for non-volatile defaults).
  const tableStatements = [
    `ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "ignore_reason" text`,
    `ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp with time zone`,
    `ALTER TABLE "billing_subscriptions" ADD COLUMN IF NOT EXISTS "last_event_created_at" timestamp with time zone`,
    `ALTER TABLE "billing_subscriptions" ALTER COLUMN "price_ids" SET DEFAULT '{}'::text[]`,
  ]
  for (const stmt of tableStatements) {
    try {
      await sql.query(stmt)
      console.log(`[fix] OK: ${stmt}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[fix] FAILED: ${stmt}\n  ${msg}`)
      throw err
    }
  }

  // Verify final state.
  const enumValues = await sql.query(
    `SELECT enumlabel FROM pg_enum
     WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'stripe_webhook_event_status')
     ORDER BY enumsortorder`
  )
  console.log(
    `\n[fix] stripe_webhook_event_status values: [${(enumValues as Array<{ enumlabel: string }>).map((r) => r.enumlabel).join(", ")}]`
  )

  const eventCols = await sql.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'stripe_webhook_events' AND table_schema = 'public'
     ORDER BY ordinal_position`
  )
  console.log(
    `[fix] stripe_webhook_events columns: ${(eventCols as Array<{ column_name: string }>).map((r) => r.column_name).join(", ")}`
  )

  const subCols = await sql.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'billing_subscriptions' AND table_schema = 'public'
       AND column_name = 'last_event_created_at'`
  )
  console.log(
    `[fix] billing_subscriptions.last_event_created_at exists: ${(subCols as Array<unknown>).length > 0}`
  )

  console.log(
    "\n[fix] Done. Re-run pnpm --filter @eleva/db db:push to confirm 'no changes'."
  )
}

main().catch((err) => {
  console.error("[fix] Fatal:", err)
  process.exit(1)
})
