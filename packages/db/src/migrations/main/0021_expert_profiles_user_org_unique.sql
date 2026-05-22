CREATE UNIQUE INDEX IF NOT EXISTS "expert_profiles_user_org_idx" ON "expert_profiles" ("user_id", "org_id") WHERE "deleted_at" IS NULL;
