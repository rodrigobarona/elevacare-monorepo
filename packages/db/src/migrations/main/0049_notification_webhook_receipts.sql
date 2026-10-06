-- AUD-015: durable dedupe for Resend webhook redeliveries (svix-id).
-- Idempotent so a mid-file retry on a Neon preview branch can finish.

CREATE TABLE IF NOT EXISTS "notification_webhook_receipts" (
  "provider" text NOT NULL,
  "message_id" text NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_webhook_receipts_provider_message_id_pk"
    PRIMARY KEY ("provider", "message_id")
);
--> statement-breakpoint
ALTER TABLE "notification_webhook_receipts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notification_webhook_receipts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS notification_webhook_receipts_service_only ON "notification_webhook_receipts";
--> statement-breakpoint
CREATE POLICY notification_webhook_receipts_service_only
  ON "notification_webhook_receipts"
  USING (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  )
  WITH CHECK (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  );
