ALTER TABLE "meetings" DROP CONSTRAINT "meetings_stripe_payout_id_unique";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_transfer_id_idx" ON "meetings" USING btree ("stripe_transfer_id");--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "stripe_payout_id";--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "stripe_payout_amount";--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "stripe_payout_failure_code";--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "stripe_payout_failure_message";--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "stripe_payout_paid_at";--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "last_processed_at";