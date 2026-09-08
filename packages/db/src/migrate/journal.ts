import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type JournalEntry = {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

export type JournalFile = {
  version: string
  dialect: string
  entries: JournalEntry[]
}

export type PreparedMigration = {
  tag: string
  statements: string[]
  folderMillis: number
  hash: string
}

/**
 * Postgres SQLSTATE codes that mean "this object is already there".
 * Used only when repairing a database whose drizzle journal table is empty
 * but whose schema was created outside drizzle-kit migrate.
 */
export const ALREADY_APPLIED_SQLSTATES = new Set([
  "42710", // duplicate_object (type, constraint, policy)
  "42P07", // duplicate_table / duplicate_relation
  "42723", // duplicate_function
  "42701", // duplicate_column
  "42P06", // duplicate_schema
])

export function isAlreadyAppliedError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const code = "code" in err ? String(err.code) : ""
  if (ALREADY_APPLIED_SQLSTATES.has(code)) return true
  const message = "message" in err ? String(err.message) : ""
  return /already exists/i.test(message)
}

export function hashMigrationSql(sql: string): string {
  return createHash("sha256").update(sql).digest("hex")
}

export function splitMigrationSql(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

export function readJournal(migrationsFolder: string): JournalFile {
  const journalPath = join(migrationsFolder, "meta/_journal.json")
  if (!existsSync(journalPath)) {
    throw new Error(`Can't find meta/_journal.json in ${migrationsFolder}`)
  }
  return JSON.parse(readFileSync(journalPath, "utf8")) as JournalFile
}

export function readPreparedMigrations(
  migrationsFolder: string
): PreparedMigration[] {
  const journal = readJournal(migrationsFolder)
  return journal.entries.map((entry) => {
    const migrationPath = join(migrationsFolder, `${entry.tag}.sql`)
    if (!existsSync(migrationPath)) {
      throw new Error(`No file ${migrationPath} found`)
    }
    const sql = readFileSync(migrationPath, "utf8")
    return {
      tag: entry.tag,
      statements: splitMigrationSql(sql),
      folderMillis: entry.when,
      hash: hashMigrationSql(sql),
    }
  })
}
