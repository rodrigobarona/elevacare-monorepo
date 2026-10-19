-- Public expert profile content: rich bio, social links, credentials, and
-- per-service "What's included", "What to expect" and "Example questions".
-- Additive only; existing plain-text `bio` keeps feeding search.
-- Idempotent so a mid-file retry on a Neon preview branch can finish.

ALTER TABLE "expert_profiles"
  ADD COLUMN IF NOT EXISTS "bio_rich" jsonb;
--> statement-breakpoint
ALTER TABLE "expert_profiles"
  ADD COLUMN IF NOT EXISTS "bio_source_locale" varchar(2);
--> statement-breakpoint
ALTER TABLE "expert_profiles"
  ADD COLUMN IF NOT EXISTS "social_links" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "expert_profiles"
  ADD COLUMN IF NOT EXISTS "credentials" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "event_types"
  ADD COLUMN IF NOT EXISTS "whats_included" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "event_types"
  ADD COLUMN IF NOT EXISTS "what_to_expect" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "event_types"
  ADD COLUMN IF NOT EXISTS "example_questions" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "expert_profiles"
  DROP CONSTRAINT IF EXISTS "expert_profiles_content_shape";
--> statement-breakpoint
ALTER TABLE "expert_profiles"
  ADD CONSTRAINT "expert_profiles_content_shape"
  CHECK (
    jsonb_typeof("social_links") = 'array'
    AND jsonb_typeof("credentials") = 'array'
    AND ("bio_rich" IS NULL OR jsonb_typeof("bio_rich") = 'object')
    AND ("bio_source_locale" IS NULL OR "bio_source_locale" IN ('en', 'pt', 'es'))
  );
--> statement-breakpoint
ALTER TABLE "event_types"
  DROP CONSTRAINT IF EXISTS "event_types_content_shape";
--> statement-breakpoint
ALTER TABLE "event_types"
  ADD CONSTRAINT "event_types_content_shape"
  CHECK (
    jsonb_typeof("whats_included") = 'object'
    AND jsonb_typeof("what_to_expect") = 'object'
    AND jsonb_typeof("example_questions") = 'object'
  );
