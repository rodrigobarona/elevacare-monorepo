-- Discard older duplicate open dead-letter rows (keep newest per
-- workflow_name + entity_id), then recreate the unique index from 0036.
-- Idempotent: a branch that already has the index and no duplicates is a no-op.

UPDATE "workflow_dead_letters" AS older
SET
  "status" = 'discarded',
  "updated_at" = now()
WHERE older."status" = 'open'
  AND older."entity_id" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "workflow_dead_letters" AS newer
    WHERE newer."workflow_name" = older."workflow_name"
      AND newer."entity_id" = older."entity_id"
      AND newer."status" = 'open'
      AND (
        newer."created_at" > older."created_at"
        OR (
          newer."created_at" = older."created_at"
          AND newer."id" > older."id"
        )
      )
  );
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_dead_letters_open_entity_uidx"
  ON "workflow_dead_letters" ("workflow_name", "entity_id")
  WHERE "status" = 'open' AND "entity_id" IS NOT NULL;
