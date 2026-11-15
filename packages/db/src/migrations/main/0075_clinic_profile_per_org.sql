-- One clinic profile per team org, so provisioning is idempotent and a
-- slug clash with another clinic is detected instead of hidden (11.1b).
CREATE UNIQUE INDEX IF NOT EXISTS "clinic_profiles_org_uidx"
  ON "clinic_profiles" ("org_id");
--> statement-breakpoint
DROP INDEX IF EXISTS "clinic_profiles_org_idx";
