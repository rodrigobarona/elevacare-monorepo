/**
 * Apply drizzle SQL migrations for main or audit.
 *
 * Replaces `drizzle-kit migrate` so an empty `drizzle.__drizzle_migrations`
 * table on a database that already has schema (the current Neon parent) can
 * catch up: already-created objects are recorded, then pending files run.
 */
import { resolve } from "node:path"
import { applyMigrations } from "../src/migrate/apply-migrations"

const AUDIT = process.argv.includes("--audit")

async function main() {
  const url = AUDIT
    ? (process.env.AUDIT_DATABASE_URL_UNPOOLED ??
      process.env.AUDIT_DATABASE_URL)
    : (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)
  if (!url) {
    throw new Error(
      AUDIT ? "AUDIT_DATABASE_URL is required" : "DATABASE_URL is required"
    )
  }

  const migrationsFolder = resolve(
    import.meta.dirname,
    AUDIT ? "../src/migrations/audit" : "../src/migrations/main"
  )

  await applyMigrations({
    connectionString: url,
    migrationsFolder,
    label: AUDIT ? "audit" : "main",
  })
}

void main()
