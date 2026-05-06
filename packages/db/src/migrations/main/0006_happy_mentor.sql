DROP INDEX "event_types_expert_slug_idx";--> statement-breakpoint
ALTER TABLE "date_overrides" ALTER COLUMN "override_date" SET DATA TYPE date;--> statement-breakpoint
CREATE UNIQUE INDEX "event_types_expert_slug_idx" ON "event_types" USING btree ("expert_profile_id","slug") WHERE deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_duration_positive" CHECK (duration_minutes > 0);--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_price_non_negative" CHECK (price_amount >= 0);--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_windows_non_negative" CHECK ((booking_window_days IS NULL OR booking_window_days >= 0) AND minimum_notice_minutes >= 0 AND buffer_before_minutes >= 0 AND buffer_after_minutes >= 0 AND (cancellation_window_hours IS NULL OR cancellation_window_hours >= 0) AND (reschedule_window_hours IS NULL OR reschedule_window_hours >= 0) AND position >= 0);--> statement-breakpoint
ALTER TABLE "expert_integrations" ADD CONSTRAINT "expert_integrations_api_key_check" CHECK (connect_type != 'api_key' OR vault_ref IS NOT NULL);