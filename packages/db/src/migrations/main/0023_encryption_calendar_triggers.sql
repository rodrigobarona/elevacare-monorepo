DELETE FROM "org_data_keys" d
WHERE d.ctid NOT IN (
  SELECT min(k.ctid)
  FROM "org_data_keys" k
  GROUP BY k."org_id", k."key_version"
);
--> statement-breakpoint
UPDATE "org_data_keys" d
SET "retired_at" = now()
WHERE "retired_at" IS NULL
  AND EXISTS (
    SELECT 1 FROM "org_data_keys" k
    WHERE k."org_id" = d."org_id"
      AND k."retired_at" IS NULL
      AND k."key_version" > d."key_version"
  );
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_data_keys_org_version_uidx"
  ON "org_data_keys" ("org_id", "key_version");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_data_keys_one_active_uidx"
  ON "org_data_keys" ("org_id")
  WHERE "retired_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "expert_integrations"
  ADD COLUMN IF NOT EXISTS "auth_account_id" uuid;
--> statement-breakpoint
ALTER TABLE "expert_integrations"
  DROP CONSTRAINT IF EXISTS "expert_integrations_auth_account_id_fkey";
--> statement-breakpoint
ALTER TABLE "expert_integrations"
  ADD CONSTRAINT "expert_integrations_auth_account_id_fkey"
  FOREIGN KEY ("auth_account_id")
  REFERENCES "auth"."account"("id")
  ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "expert_integrations" DROP CONSTRAINT IF EXISTS "expert_integrations_pipes_check";
--> statement-breakpoint
ALTER TABLE "expert_integrations" ADD CONSTRAINT "expert_integrations_pipes_check"
  CHECK (
    "connect_type" != 'pipes'
    OR "auth_account_id" IS NOT NULL
    OR "workos_user_id" IS NOT NULL
  );
--> statement-breakpoint
DROP TRIGGER IF EXISTS "forbid_legacy_identity_write_users" ON "users";
--> statement-breakpoint
CREATE TRIGGER "forbid_legacy_identity_write_users"
  BEFORE INSERT OR UPDATE OR DELETE ON "users"
  FOR EACH ROW
  EXECUTE FUNCTION auth.forbid_legacy_identity_write();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "forbid_legacy_identity_write_organizations" ON "organizations";
--> statement-breakpoint
CREATE TRIGGER "forbid_legacy_identity_write_organizations"
  BEFORE INSERT OR UPDATE OR DELETE ON "organizations"
  FOR EACH ROW
  EXECUTE FUNCTION auth.forbid_legacy_identity_write();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "forbid_legacy_identity_write_memberships" ON "memberships";
--> statement-breakpoint
CREATE TRIGGER "forbid_legacy_identity_write_memberships"
  BEFORE INSERT OR UPDATE OR DELETE ON "memberships"
  FOR EACH ROW
  EXECUTE FUNCTION auth.forbid_legacy_identity_write();
