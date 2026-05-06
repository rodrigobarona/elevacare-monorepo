/**
 * FTS prerequisite installer — creates extensions and text search configs
 * that Drizzle cannot manage. Run once per fresh database:
 *
 *   pnpm --filter @eleva/db db:fts
 *
 * The generated column (search_vector) and indexes (GIN + trigram) are
 * now declared in the Drizzle schema (expert-profiles.ts) and managed
 * by drizzle-kit migrations.
 */

import { neon } from "@neondatabase/serverless"

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

if (!url) {
  console.error("DATABASE_URL or DATABASE_URL_UNPOOLED must be set")
  process.exit(1)
}

const sql = neon(url)

const statements: { label: string; query: string }[] = [
  {
    label: "Enable pg_trgm",
    query: "CREATE EXTENSION IF NOT EXISTS pg_trgm",
  },
  {
    label: "Enable unaccent",
    query: "CREATE EXTENSION IF NOT EXISTS unaccent",
  },
  {
    label: "Create FTS configs (idempotent)",
    query: `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'eleva_fts_pt') THEN
    CREATE TEXT SEARCH CONFIGURATION eleva_fts_pt (COPY = portuguese);
    ALTER TEXT SEARCH CONFIGURATION eleva_fts_pt
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'eleva_fts_en') THEN
    CREATE TEXT SEARCH CONFIGURATION eleva_fts_en (COPY = english);
    ALTER TEXT SEARCH CONFIGURATION eleva_fts_en
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, english_stem;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'eleva_fts_es') THEN
    CREATE TEXT SEARCH CONFIGURATION eleva_fts_es (COPY = spanish);
    ALTER TEXT SEARCH CONFIGURATION eleva_fts_es
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'eleva_fts_simple') THEN
    CREATE TEXT SEARCH CONFIGURATION eleva_fts_simple (COPY = simple);
    ALTER TEXT SEARCH CONFIGURATION eleva_fts_simple
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;
  END IF;
END $$`,
  },
]

console.log(`Running ${statements.length} FTS prerequisite statements…\n`)

for (const [i, { label, query }] of statements.entries()) {
  console.log(`  [${i + 1}/${statements.length}] ${label}`)
  try {
    await sql.query(query)
    console.log(`         done\n`)
  } catch (err) {
    console.error(`         FAILED:`, err)
    process.exit(1)
  }
}

console.log("FTS prerequisites installed.")
