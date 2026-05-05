/**
 * Expert FTS migration — run AFTER db:push creates the expert_profiles table.
 *
 * Phase 1 (extensions + FTS configs) is idempotent and can run at any time.
 * Phase 2 (generated column + indexes) requires expert_profiles to exist.
 *
 * Usage:
 *   pnpm --filter @eleva/db db:fts
 *
 * Or run the SQL statements manually via the Neon console / MCP.
 */

-- Phase 1: Extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

--> statement-breakpoint

-- Phase 1: Multi-language FTS configs (idempotent via DO block)
DO $$
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
END
$$;

--> statement-breakpoint

-- Phase 2: Drop the plain column that db:push created and re-add as GENERATED
DO $$
BEGIN
  IF EXISTS (
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
  END IF;
END
$$;

--> statement-breakpoint

-- Phase 2: GIN index for full-text search (idempotent)
CREATE INDEX IF NOT EXISTS expert_profiles_search_idx
  ON expert_profiles USING GIN (search_vector);

--> statement-breakpoint

-- Phase 2: Trigram index for typo-tolerant fallback (idempotent)
CREATE INDEX IF NOT EXISTS expert_profiles_name_trgm_idx
  ON expert_profiles USING GIN (display_name gin_trgm_ops);
