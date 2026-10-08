-- Better Auth 1.7 Drizzle adapter: twoFactor lockout columns, apikey
-- configId, and userId optional (owner is referenceId).
ALTER TABLE "auth"."twoFactor"
  ADD COLUMN IF NOT EXISTS "verified" boolean DEFAULT true;
--> statement-breakpoint
ALTER TABLE "auth"."twoFactor"
  ADD COLUMN IF NOT EXISTS "failed_verification_count" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "auth"."twoFactor"
  ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "auth"."apikey"
  ADD COLUMN IF NOT EXISTS "config_id" text DEFAULT 'default' NOT NULL;
--> statement-breakpoint
ALTER TABLE "auth"."apikey" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_apikey_config_idx"
  ON "auth"."apikey" USING btree ("config_id");
