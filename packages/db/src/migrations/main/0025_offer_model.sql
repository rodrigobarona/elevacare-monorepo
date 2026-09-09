-- Phase 04.1a offer model (additive). RLS: event_type_modes, booking_links,
-- calendar_feed_tokens = tenant-owned; public_handles = public-read.
-- Do not DROP event_locations or legacy event_types columns in this slice.

CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE TYPE "public"."event_type_kind" AS ENUM('clinical', 'non_clinical');
--> statement-breakpoint
CREATE TYPE "public"."event_type_visibility" AS ENUM('public', 'unlisted', 'private');
--> statement-breakpoint
CREATE TYPE "public"."country_scope_type" AS ENUM('worldwide', 'list');
--> statement-breakpoint
CREATE TYPE "public"."public_handle_owner_kind" AS ENUM('expert', 'clinic');
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD COLUMN "practice_country" varchar(2) NOT NULL DEFAULT 'PT';
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD COLUMN "service_countries" text[] NOT NULL DEFAULT ARRAY['PT']::text[];
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD COLUMN "worldwide_remote" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD COLUMN "accepting_bookings" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
UPDATE "expert_profiles"
SET "practice_country" = upper(practice_countries[1])
WHERE cardinality(practice_countries) >= 1
  AND practice_countries[1] ~ '^[A-Za-z]{2}$';
--> statement-breakpoint
UPDATE "expert_profiles"
SET "service_countries" = (
  SELECT ARRAY(
    SELECT DISTINCT upper(c) FROM unnest(practice_countries) AS c
    WHERE c ~ '^[A-Za-z]{2}$'
  )
)
WHERE cardinality(practice_countries) >= 1;
--> statement-breakpoint
UPDATE "expert_profiles"
SET "service_countries" = array_append("service_countries", "practice_country")
WHERE NOT ("practice_country" = ANY("service_countries"));
--> statement-breakpoint
UPDATE "expert_profiles"
SET "worldwide_remote" = true
WHERE "worldwide_mode" = true;
--> statement-breakpoint
UPDATE "expert_profiles"
SET "languages" = ARRAY['en']::text[]
WHERE cardinality("languages") < 1;
--> statement-breakpoint
ALTER TABLE "expert_profiles" ALTER COLUMN "languages" SET DEFAULT ARRAY['en']::text[];
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_languages_min"
  CHECK (cardinality(languages) >= 1);
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_practice_country"
  CHECK (practice_country ~ '^[A-Z]{2}$');
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_service_contains_practice"
  CHECK (practice_country = ANY(service_countries));
--> statement-breakpoint
UPDATE "expert_profiles"
SET "service_countries" = ARRAY(
  SELECT DISTINCT upper(c) FROM unnest("service_countries") AS c
  WHERE c ~ '^[A-Za-z]{2}$'
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.iso3166_alpha2_codes(codes text[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  c text;
BEGIN
  IF codes IS NULL THEN
    RETURN false;
  END IF;
  FOREACH c IN ARRAY codes LOOP
    IF c IS NULL OR c !~ '^[A-Z]{2}$' THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_service_countries_format"
  CHECK (public.iso3166_alpha2_codes(service_countries));
--> statement-breakpoint
ALTER TABLE "expert_practice_locations" ADD COLUMN "line2" varchar(200);
--> statement-breakpoint
ALTER TABLE "expert_practice_locations" ADD COLUMN "region" varchar(100);
--> statement-breakpoint
ALTER TABLE "expert_practice_locations" ADD COLUMN "timezone" varchar(64);
--> statement-breakpoint
ALTER TABLE "expert_practice_locations" ADD COLUMN "instructions" jsonb;
--> statement-breakpoint
ALTER TABLE "expert_practice_locations" ADD COLUMN "active" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "kind" "event_type_kind" NOT NULL DEFAULT 'non_clinical';
--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "visibility" "event_type_visibility" NOT NULL DEFAULT 'public';
--> statement-breakpoint
ALTER TABLE "event_types" DROP CONSTRAINT IF EXISTS "event_types_currency_iso";
--> statement-breakpoint
DO $$
DECLARE
  offending integer;
BEGIN
  SELECT count(*) INTO offending FROM "event_types" WHERE "currency" <> 'EUR';
  IF offending > 0 THEN
    RAISE EXCEPTION
      '0025_offer_model: % event_types row(s) are not EUR; migrate prices first',
      offending;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_currency_eur" CHECK (currency = 'EUR');
--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_org_id_id_key" UNIQUE ("org_id", "id");
--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_org_id_id_key" UNIQUE ("org_id", "id");
--> statement-breakpoint
ALTER TABLE "expert_practice_locations" ADD CONSTRAINT "expert_practice_locations_org_id_id_key" UNIQUE ("org_id", "id");
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_org_id_id_key" UNIQUE ("org_id", "id");
--> statement-breakpoint
CREATE TABLE "event_type_modes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "event_type_id" uuid NOT NULL,
  "mode" "session_mode" NOT NULL,
  "location_id" uuid,
  "schedule_id" uuid NOT NULL,
  "price_cents" integer,
  "currency" varchar(3),
  "duration_minutes" integer,
  "country_scope_type" "country_scope_type" NOT NULL,
  "country_scope_codes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "languages" text[] NOT NULL,
  "label" jsonb,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "event_type_modes_in_person_location"
    CHECK ((mode = 'in_person') = (location_id IS NOT NULL)),
  CONSTRAINT "event_type_modes_country_scope"
    CHECK (
      (country_scope_type = 'worldwide' AND cardinality(country_scope_codes) = 0)
      OR (country_scope_type = 'list' AND cardinality(country_scope_codes) >= 1)
    ),
  CONSTRAINT "event_type_modes_country_scope_format"
    CHECK (public.iso3166_alpha2_codes(country_scope_codes)),
  CONSTRAINT "event_type_modes_currency_eur"
    CHECK (currency IS NULL OR currency = 'EUR'),
  CONSTRAINT "event_type_modes_price_cents"
    CHECK (price_cents IS NULL OR price_cents >= 0),
  CONSTRAINT "event_type_modes_price_currency"
    CHECK ((price_cents IS NULL) = (currency IS NULL)),
  CONSTRAINT "event_type_modes_languages_min"
    CHECK (cardinality(languages) >= 1),
  CONSTRAINT "event_type_modes_event_type_fk"
    FOREIGN KEY ("org_id", "event_type_id")
    REFERENCES "event_types"("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "event_type_modes_schedule_fk"
    FOREIGN KEY ("org_id", "schedule_id")
    REFERENCES "schedules"("org_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "event_type_modes_location_fk"
    FOREIGN KEY ("org_id", "location_id")
    REFERENCES "expert_practice_locations"("org_id", "id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX "event_type_modes_org_idx" ON "event_type_modes" ("org_id");
--> statement-breakpoint
CREATE INDEX "event_type_modes_event_type_idx" ON "event_type_modes" ("event_type_id");
--> statement-breakpoint
CREATE INDEX "event_type_modes_schedule_idx" ON "event_type_modes" ("org_id", "schedule_id");
--> statement-breakpoint
CREATE INDEX "event_type_modes_location_idx" ON "event_type_modes" ("org_id", "location_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "event_type_modes_unique_idx" ON "event_type_modes" ("event_type_id", "mode", "location_id") NULLS NOT DISTINCT;
--> statement-breakpoint
ALTER TABLE "event_type_modes" ADD CONSTRAINT "event_type_modes_org_id_id_key" UNIQUE ("org_id", "id");
--> statement-breakpoint
ALTER TABLE "event_type_modes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_type_modes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "event_type_modes_tenant_isolation" ON "event_type_modes" AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true))
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true));
--> statement-breakpoint
CREATE TABLE "booking_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "event_type_id" uuid NOT NULL,
  "event_type_mode_id" uuid,
  "schedule_id" uuid,
  "token_hash" char(64) NOT NULL,
  "recipient_email" varchar(320),
  "price_cents" integer,
  "note" text,
  "expires_at" timestamp with time zone NOT NULL,
  "max_uses" integer DEFAULT 1 NOT NULL,
  "use_count" integer DEFAULT 0 NOT NULL,
  "created_by" uuid REFERENCES "auth"."user"("id") ON DELETE SET NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "booking_links_max_uses" CHECK (max_uses >= 1),
  CONSTRAINT "booking_links_use_count" CHECK (use_count >= 0 AND use_count <= max_uses),
  CONSTRAINT "booking_links_price_cents"
    CHECK (price_cents IS NULL OR price_cents >= 0),
  CONSTRAINT "booking_links_event_type_fk"
    FOREIGN KEY ("org_id", "event_type_id")
    REFERENCES "event_types"("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "booking_links_mode_fk"
    FOREIGN KEY ("org_id", "event_type_mode_id")
    REFERENCES "event_type_modes"("org_id", "id")
    ON DELETE SET NULL ("event_type_mode_id"),
  CONSTRAINT "booking_links_schedule_fk"
    FOREIGN KEY ("org_id", "schedule_id")
    REFERENCES "schedules"("org_id", "id")
    ON DELETE SET NULL ("schedule_id")
);
--> statement-breakpoint
CREATE INDEX "booking_links_org_idx" ON "booking_links" ("org_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_links_token_hash_idx" ON "booking_links" ("token_hash");
--> statement-breakpoint
ALTER TABLE "booking_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "booking_links" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "booking_links_tenant_isolation" ON "booking_links" AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true))
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true));
--> statement-breakpoint
CREATE TABLE "calendar_feed_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "expert_profile_id" uuid NOT NULL,
  "token_hash" char(64) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "calendar_feed_tokens_expert_fk"
    FOREIGN KEY ("org_id", "expert_profile_id")
    REFERENCES "expert_profiles"("org_id", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "calendar_feed_tokens_org_idx" ON "calendar_feed_tokens" ("org_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feed_tokens_token_hash_idx" ON "calendar_feed_tokens" ("token_hash");
--> statement-breakpoint
ALTER TABLE "calendar_feed_tokens" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "calendar_feed_tokens" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "calendar_feed_tokens_tenant_isolation" ON "calendar_feed_tokens" AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true))
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true));
--> statement-breakpoint
CREATE TABLE "public_handles" (
  "handle" citext PRIMARY KEY,
  "owner_kind" "public_handle_owner_kind" NOT NULL,
  "owner_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "public_handles_format"
    CHECK (
      handle::text ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$'
      AND handle::text NOT LIKE '%--%'
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "public_handles_owner_idx" ON "public_handles" ("owner_kind", "owner_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reserved_public_handles()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'member','expert','org','admin','settings','callback','logout','docs',
    'pt','es','en','br','home','about','legal','privacy','terms','cookies',
    'blog','experts','categories','become-partner','clinics','partners',
    'careers','pricing','help','support','faq','contact','auth','signin',
    'signup','login','dashboard','account','onboarding','setup',
    '_next','_vercel','vercel','favicon.ico','robots.txt','sitemap.xml',
    'manifest.json','icon','apple-icon','opengraph-image','twitter-image',
    'sitemap','robots','manifest','fonts','images','assets','static','icons',
    'academy','courses','team','teams','www','mail','status','sessions',
    'email','api','app'
  ]::text[];
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reject_reserved_public_handle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF lower(NEW.handle::text) = ANY(public.reserved_public_handles()) THEN
    RAISE EXCEPTION 'reserved public handle: %', NEW.handle
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
INSERT INTO "public_handles" ("handle", "owner_kind", "owner_id", "created_at")
SELECT DISTINCT ON (lower("username")) "username", 'expert', "id", "created_at"
FROM "expert_profiles"
WHERE "deleted_at" IS NULL
  AND NOT (lower("username") = ANY(public.reserved_public_handles()))
  AND "username" ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$'
  AND "username" NOT LIKE '%--%'
ORDER BY lower("username"), "created_at", "id";
--> statement-breakpoint
DO $$
DECLARE
  skipped integer;
  malformed integer;
BEGIN
  SELECT count(*) INTO skipped
  FROM "expert_profiles"
  WHERE "deleted_at" IS NULL
    AND lower("username") = ANY(public.reserved_public_handles());
  IF skipped > 0 THEN
    RAISE NOTICE '0025_offer_model skipped % reserved expert username(s)', skipped;
  END IF;
  SELECT count(*) INTO malformed
  FROM "expert_profiles"
  WHERE "deleted_at" IS NULL
    AND NOT (lower("username") = ANY(public.reserved_public_handles()))
    AND (
      "username" !~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$'
      OR "username" LIKE '%--%'
    );
  IF malformed > 0 THEN
    RAISE NOTICE '0025_offer_model skipped % malformed expert username(s)', malformed;
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  collided integer;
BEGIN
  SELECT count(*) INTO collided
  FROM (
    SELECT lower("username")
    FROM "expert_profiles"
    WHERE "deleted_at" IS NULL
      AND NOT (lower("username") = ANY(public.reserved_public_handles()))
      AND "username" ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$'
      AND "username" NOT LIKE '%--%'
    GROUP BY lower("username")
    HAVING count(*) > 1
  ) dup;
  IF collided > 0 THEN
    RAISE WARNING
      '0025_offer_model: % duplicate username(s) got only one public_handles row',
      collided;
  END IF;
END $$;
--> statement-breakpoint
CREATE TRIGGER reject_reserved_public_handle
  BEFORE INSERT OR UPDATE OF handle ON public_handles
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_reserved_public_handle();
--> statement-breakpoint
ALTER TABLE "public_handles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public_handles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "public_handles_public_read" ON "public_handles" AS PERMISSIVE FOR SELECT TO public
  USING (true);
--> statement-breakpoint
CREATE POLICY "public_handles_admin_write" ON "public_handles" AS PERMISSIVE FOR ALL TO public
  USING (current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (current_setting('eleva.platform_admin', true) = 'true');
