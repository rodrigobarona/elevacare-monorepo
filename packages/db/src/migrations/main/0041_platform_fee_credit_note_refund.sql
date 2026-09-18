-- One closed-gate credit note per commission-reducing refund.
-- Does not POST TOConline documents. Table is new in 0039 (no live rows).

ALTER TABLE "platform_fee_credit_notes"
  ADD COLUMN IF NOT EXISTS "booking_refund_id" uuid;
--> statement-breakpoint
ALTER TABLE "platform_fee_credit_notes"
  ALTER COLUMN "booking_refund_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "platform_fee_credit_notes" DROP CONSTRAINT IF EXISTS "platform_fee_credit_notes_refund_org_fk";
--> statement-breakpoint
ALTER TABLE "platform_fee_credit_notes" ADD CONSTRAINT "platform_fee_credit_notes_refund_org_fk"
  FOREIGN KEY ("booking_refund_id", "org_id") REFERENCES "booking_refunds" ("id", "org_id")
  ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "platform_fee_credit_notes" DROP CONSTRAINT IF EXISTS "platform_fee_credit_notes_refund_key";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform_fee_credit_notes"
    ADD CONSTRAINT "platform_fee_credit_notes_refund_key"
    UNIQUE ("booking_refund_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_fee_credit_notes_refund_idx"
  ON "platform_fee_credit_notes" ("booking_refund_id");
