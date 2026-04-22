ALTER TABLE "users" ADD COLUMN "google_access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_refresh_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_token_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_calendar_connected" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_calendar_connected_at" timestamp;