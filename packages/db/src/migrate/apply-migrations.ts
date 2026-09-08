import { neon } from "@neondatabase/serverless"
import { readPreparedMigrations, type PreparedMigration } from "./journal"

const MIGRATIONS_SCHEMA = "drizzle"
const MIGRATIONS_TABLE = "__drizzle_migrations"

/**
 * Object-presence checks for migrations that may still be pending on a
 * database whose drizzle journal table was never populated. Unlisted tags
 * are treated as applied when they sit before the first failed check.
 */
export const MIGRATION_APPLIED_CHECKS: Record<string, string> = {
  "0020_add_academy_org_type": `SELECT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'org_type' AND e.enumlabel = 'academy'
    ) AS applied`,
  "0021_expert_profiles_user_org_unique": `SELECT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname = 'expert_profiles_user_org_idx'
    ) AS applied`,
  "0022_better_auth_identity": `SELECT to_regclass('public.org_data_keys') IS NOT NULL
      OR to_regclass('auth.user') IS NOT NULL AS applied`,
}

type Sql = {
  query: (query: string, params?: unknown[]) => Promise<unknown>
}

export type ApplyMigrationsResult = {
  applied: string[]
  skipped: string[]
  repaired: boolean
}

async function ensureMigrationsTable(sql: Sql) {
  await sql.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`)
  await sql.query(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)
}

async function appliedHashes(sql: Sql): Promise<Set<string>> {
  const rows = (await sql.query(
    `SELECT hash FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`
  )) as { hash: string }[]
  return new Set(rows.map((row) => row.hash))
}

async function schemaLooksProvisioned(sql: Sql): Promise<boolean> {
  const rows = (await sql.query(
    `SELECT to_regclass('public.users') IS NOT NULL
      OR to_regclass('public.audit_events') IS NOT NULL AS ready`
  )) as { ready: boolean }[]
  return Boolean(rows[0]?.ready)
}

async function markerApplied(sql: Sql, tag: string): Promise<boolean | null> {
  const check = MIGRATION_APPLIED_CHECKS[tag]
  if (!check) return null
  const rows = (await sql.query(check)) as { applied: boolean }[]
  return Boolean(rows[0]?.applied)
}

/**
 * When the journal table is empty on a live schema, record every migration
 * before the first object-check miss so drizzle can apply the rest.
 */
export function pendingFromMarkers(
  tags: string[],
  appliedByTag: Record<string, boolean | null>
): number {
  const hasCheck = tags.some((tag) => appliedByTag[tag] !== null)
  if (!hasCheck) return tags.length

  let lastChecked = -1
  for (const [index, tag] of tags.entries()) {
    const applied = appliedByTag[tag]
    if (applied === null) continue
    lastChecked = index
    if (!applied) return index
  }
  return lastChecked + 1
}

async function recordMigration(sql: Sql, migration: PreparedMigration) {
  await sql.query(
    `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ("hash", "created_at")
     VALUES ($1, $2)`,
    [migration.hash, migration.folderMillis]
  )
}

export async function applyMigrations(options: {
  connectionString: string
  migrationsFolder: string
  label: string
}): Promise<ApplyMigrationsResult> {
  const sql: Sql = neon(options.connectionString)
  const migrations = readPreparedMigrations(options.migrationsFolder)
  await ensureMigrationsTable(sql)

  let hashes = await appliedHashes(sql)
  let repaired = false

  if (hashes.size === 0 && (await schemaLooksProvisioned(sql))) {
    const appliedByTag: Record<string, boolean | null> = {}
    for (const migration of migrations) {
      appliedByTag[migration.tag] = await markerApplied(sql, migration.tag)
    }
    const firstPending = pendingFromMarkers(
      migrations.map((migration) => migration.tag),
      appliedByTag
    )
    const baseline = migrations.slice(0, firstPending)
    if (baseline.length > 0) {
      console.log(
        `[migrate] ${options.label}: empty journal on existing schema; recording ${baseline[0]?.tag}..${baseline.at(-1)?.tag}`
      )
      for (const migration of baseline) {
        await recordMigration(sql, migration)
      }
      hashes = await appliedHashes(sql)
      repaired = true
    }
  }

  const applied: string[] = []
  const skipped: string[] = []

  for (const migration of migrations) {
    if (hashes.has(migration.hash)) {
      skipped.push(migration.tag)
      continue
    }
    console.log(`[migrate] ${options.label}: applying ${migration.tag}`)
    for (const statement of migration.statements) {
      try {
        await sql.query(statement)
      } catch (err) {
        const preview = statement.replace(/\s+/g, " ").slice(0, 160)
        console.error(`[migrate] ${migration.tag} failed: ${preview}`)
        throw err
      }
    }
    await recordMigration(sql, migration)
    hashes.add(migration.hash)
    applied.push(migration.tag)
  }

  console.log(
    `[migrate] ${options.label}: applied ${applied.length}, already recorded ${skipped.length}`
  )
  return { applied, skipped, repaired }
}
