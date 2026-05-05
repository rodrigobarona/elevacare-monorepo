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
  {
    label: "Add or replace search_vector as GENERATED column",
    query: `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expert_profiles' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE expert_profiles ADD COLUMN search_vector tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('eleva_fts_simple', coalesce(display_name, '')), 'A') ||
        setweight(to_tsvector('eleva_fts_simple', coalesce(headline, '')), 'B') ||
        setweight(to_tsvector('eleva_fts_simple', coalesce(bio, '')), 'C')
      ) STORED;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expert_profiles' AND column_name = 'search_vector'
      AND is_generated = 'NEVER'
  ) THEN
    ALTER TABLE expert_profiles DROP COLUMN search_vector;
    ALTER TABLE expert_profiles ADD COLUMN search_vector tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('eleva_fts_simple', coalesce(display_name, '')), 'A') ||
        setweight(to_tsvector('eleva_fts_simple', coalesce(headline, '')), 'B') ||
        setweight(to_tsvector('eleva_fts_simple', coalesce(bio, '')), 'C')
      ) STORED;
  ELSE
    RAISE NOTICE 'search_vector already exists as GENERATED column, skipping';
  END IF;
END $$`,
  },
  {
    label: "GIN index for FTS",
    query:
      "CREATE INDEX IF NOT EXISTS expert_profiles_search_idx ON expert_profiles USING GIN (search_vector)",
  },
  {
    label: "Trigram GIN index for typo tolerance",
    query:
      "CREATE INDEX IF NOT EXISTS expert_profiles_name_trgm_idx ON expert_profiles USING GIN (display_name gin_trgm_ops)",
  },
]

console.log(`Running ${statements.length} FTS migration statements…\n`)

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

console.log("FTS migration complete.")
