ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "new_device_alerts";--> statement-breakpoint
ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "email_notifications";--> statement-breakpoint
ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "in_app_notifications";--> statement-breakpoint
ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "unusual_timing_alerts";--> statement-breakpoint
ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "location_change_alerts";