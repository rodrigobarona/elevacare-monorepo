-- Phase 04.2d: transactional domain-event outbox + per-subscriber
-- deliveries. Written in the same transaction as booking confirm;
-- published by POST /workflows/domain-events-publisher.
CREATE TYPE "public"."domain_event_delivery_status" AS ENUM(
  'pending',
  'processing',
  'succeeded',
  'failed',
  'dead'
);
--> statement-breakpoint
CREATE TABLE "domain_events_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_at" timestamp with time zone,
  CONSTRAINT "domain_events_outbox_idempotency_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "domain_events_outbox_payload_object"
    CHECK (jsonb_typeof("payload") = 'object')
);
--> statement-breakpoint
CREATE INDEX "domain_events_outbox_org_idx"
  ON "domain_events_outbox" ("org_id");
--> statement-breakpoint
CREATE INDEX "domain_events_outbox_unpublished_idx"
  ON "domain_events_outbox" ("created_at")
  WHERE "published_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "domain_events_outbox" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "domain_events_outbox" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "domain_events_outbox_tenant_isolation"
  ON "domain_events_outbox" AS PERMISSIVE FOR ALL TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    OR current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  )
  WITH CHECK (
    org_id::text = current_setting('eleva.org_id', true)
    OR current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  );
--> statement-breakpoint
CREATE TABLE "domain_event_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "event_id" uuid NOT NULL REFERENCES "domain_events_outbox"("id") ON DELETE CASCADE,
  "subscriber_id" text NOT NULL,
  "status" "domain_event_delivery_status" NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "claimed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "last_error" text,
  CONSTRAINT "domain_event_deliveries_event_subscriber_key"
    UNIQUE ("event_id", "subscriber_id"),
  CONSTRAINT "domain_event_deliveries_attempts"
    CHECK (attempts >= 0)
);
--> statement-breakpoint
CREATE INDEX "domain_event_deliveries_org_idx"
  ON "domain_event_deliveries" ("org_id");
--> statement-breakpoint
CREATE INDEX "domain_event_deliveries_claim_idx"
  ON "domain_event_deliveries" ("status", "attempts")
  WHERE "status" IN ('pending', 'failed', 'processing');
--> statement-breakpoint
ALTER TABLE "domain_event_deliveries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "domain_event_deliveries" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "domain_event_deliveries_tenant_isolation"
  ON "domain_event_deliveries" AS PERMISSIVE FOR ALL TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    OR current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  )
  WITH CHECK (
    org_id::text = current_setting('eleva.org_id', true)
    OR current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  );
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD COLUMN "guest_activation_sent_at" timestamp with time zone;
