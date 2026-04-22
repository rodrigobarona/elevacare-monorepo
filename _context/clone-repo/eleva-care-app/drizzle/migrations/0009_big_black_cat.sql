ALTER TABLE "users" ADD COLUMN "theme" text DEFAULT 'light' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "security_alerts" boolean DEFAULT true NOT NULL;