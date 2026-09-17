-- One open dead-letter row per workflow + entity. Partial so resolved rows
-- can be recorded again if the same entity later fails.
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_dead_letters_open_entity_uidx"
  ON "workflow_dead_letters" ("workflow_name", "entity_id")
  WHERE "status" = 'open' AND "entity_id" IS NOT NULL;
