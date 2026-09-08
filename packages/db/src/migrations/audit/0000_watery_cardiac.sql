CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(64) NOT NULL,
	"entity" varchar(64) NOT NULL,
	"entity_id" text,
	"payload" jsonb NOT NULL,
	"correlation_id" varchar(64),
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prev_hash" text,
	"row_hash" text,
	CONSTRAINT "audit_events_audit_id_unique" UNIQUE("audit_id")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "audit_events_org_idx" ON "audit_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_received_idx" ON "audit_events" USING btree ("received_at");--> statement-breakpoint
CREATE POLICY "audit_events_tenant_read" ON "audit_events" AS PERMISSIVE FOR SELECT TO public USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');--> statement-breakpoint
CREATE POLICY "audit_events_drainer_insert" ON "audit_events" AS PERMISSIVE FOR INSERT TO public WITH CHECK (current_setting('eleva.service', true) = 'audit_drainer' OR current_setting('eleva.platform_admin', true) = 'true');