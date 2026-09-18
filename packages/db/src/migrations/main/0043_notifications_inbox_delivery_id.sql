-- Phase 08.4: inbox rows are unique per delivery so a reclaim cannot
-- insert a second notification for the same send.

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_delivery_id_key"
  ON "notifications" ("user_id", (data ->> 'deliveryId'))
  WHERE (data ->> 'deliveryId') IS NOT NULL;
