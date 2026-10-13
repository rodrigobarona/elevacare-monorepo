-- Instant Book vs Request to book (Airbnb-style). Snapshots
-- requires_approval onto holds and bookings. Request mode parks the
-- booking in awaiting_confirmation until the expert accepts, declines,
-- or the 24h/start deadline expires. Adds booking.requested /
-- request_accepted / request_declined / request_expired notification kinds.
-- Idempotent so a mid-file retry on a Neon preview branch can finish.

ALTER TABLE "slot_reservations"
  ADD COLUMN IF NOT EXISTS "requires_approval" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "requires_approval" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "approval_deadline_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_awaiting_confirmation_idx"
  ON "bookings" ("approval_deadline_at")
  WHERE "status" = 'awaiting_confirmation';
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_kind";
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind"
  CHECK (
    kind IN (
      'invoice.blocked',
      'invoice.skipped',
      'invoice.pending',
      'booking.confirmed',
      'booking.reminder_24h',
      'booking.reminder_1h',
      'booking.cancelled',
      'booking.rescheduled',
      'booking.requested',
      'booking.request_accepted',
      'booking.request_declined',
      'booking.request_expired',
      'payment.failed',
      'payment.receipt',
      'payout.paid',
      'payout.approval_required',
      'auth.magic_link',
      'auth.verify_email',
      'auth.reset_password',
      'auth.two_factor_otp',
      'auth.org_invitation'
    )
  );
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_kind_org_scope";
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_org_scope"
  CHECK (
    (
      kind IN (
        'auth.magic_link',
        'auth.verify_email',
        'auth.reset_password',
        'auth.two_factor_otp'
      )
      AND org_id IS NULL
    )
    OR (
      kind NOT IN (
        'auth.magic_link',
        'auth.verify_email',
        'auth.reset_password',
        'auth.two_factor_otp'
      )
      AND org_id IS NOT NULL
    )
  );
--> statement-breakpoint
ALTER TABLE "notification_deliveries" DROP CONSTRAINT IF EXISTS "notification_deliveries_kind";
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_kind"
  CHECK (
    kind IN (
      'invoice.blocked',
      'invoice.skipped',
      'invoice.pending',
      'booking.confirmed',
      'booking.reminder_24h',
      'booking.reminder_1h',
      'booking.cancelled',
      'booking.rescheduled',
      'booking.requested',
      'booking.request_accepted',
      'booking.request_declined',
      'booking.request_expired',
      'payment.failed',
      'payment.receipt',
      'payout.paid',
      'payout.approval_required',
      'auth.magic_link',
      'auth.verify_email',
      'auth.reset_password',
      'auth.two_factor_otp',
      'auth.org_invitation'
    )
  );
--> statement-breakpoint
ALTER TABLE "notification_deliveries" DROP CONSTRAINT IF EXISTS "notification_deliveries_kind_org_scope";
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_kind_org_scope"
  CHECK (
    (
      kind IN (
        'auth.magic_link',
        'auth.verify_email',
        'auth.reset_password',
        'auth.two_factor_otp'
      )
      AND org_id IS NULL
    )
    OR (
      kind NOT IN (
        'auth.magic_link',
        'auth.verify_email',
        'auth.reset_password',
        'auth.two_factor_otp'
      )
      AND org_id IS NOT NULL
    )
  );
