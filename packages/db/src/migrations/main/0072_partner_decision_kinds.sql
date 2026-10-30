-- Registers the partner.* Lane 1 kinds: the expert's email after a staff
-- licence decision (decision log 2026-10-29). Org scope rules are untouched
-- (the kinds are org-scoped).

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
      'crm.follow_up_due',
      'partner.approved',
      'partner.needs_changes',
      'partner.rejected',
      'auth.magic_link',
      'auth.verify_email',
      'auth.reset_password',
      'auth.two_factor_otp',
      'auth.org_invitation'
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
      'crm.follow_up_due',
      'partner.approved',
      'partner.needs_changes',
      'partner.rejected',
      'auth.magic_link',
      'auth.verify_email',
      'auth.reset_password',
      'auth.two_factor_otp',
      'auth.org_invitation'
    )
  );
