-- AUD-036: expired Daily rooms are deleted by the room sweep. The room name
-- stays on the row so late Daily webhooks still map to the session.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "room_deleted_at" timestamp with time zone;
