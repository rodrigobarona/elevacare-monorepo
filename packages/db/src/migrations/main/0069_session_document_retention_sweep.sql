-- AUD-028: retention sweep can retry Blob deletes before hard-deleting rows.
ALTER TABLE "session_documents"
  ADD COLUMN IF NOT EXISTS "retention_last_error" text,
  ADD COLUMN IF NOT EXISTS "retention_sweep_attempts" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_documents_retention_sweep_idx"
  ON "session_documents" ("created_at")
  WHERE "retention_sweep_attempts" < 3;
