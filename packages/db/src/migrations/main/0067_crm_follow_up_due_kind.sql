-- Registers the crm.follow_up_due Lane 1 kind (in-app digest of due
-- follow-ups for their author). Org scope rules are untouched (the kind
-- is org-scoped). crm_follow_ups gains the platform-admin bypass so the
-- hourly sweep can find due rows across orgs; notes stay encrypted
-- under the org DEK.

DROP POLICY IF EXISTS "crm_follow_ups_tenant_isolation" ON "crm_follow_ups";
--> statement-breakpoint
CREATE POLICY "crm_follow_ups_tenant_isolation" ON "crm_follow_ups"
  AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
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
      'crm.follow_up_due',
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
      'auth.magic_link',
      'auth.verify_email',
      'auth.reset_password',
      'auth.two_factor_otp',
      'auth.org_invitation'
    )
  );
