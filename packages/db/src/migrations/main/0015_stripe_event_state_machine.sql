ALTER TYPE "public"."stripe_webhook_event_status" ADD VALUE 'processing' BEFORE 'processed';--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ADD COLUMN "ignore_reason" text;--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ADD COLUMN "last_attempt_at" timestamp with time zone;