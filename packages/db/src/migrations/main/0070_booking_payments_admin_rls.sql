-- Stripe webhook and payout workers read booking_payments under platform_admin.
DROP POLICY IF EXISTS "booking_payments_tenant_isolation" ON "booking_payments";
--> statement-breakpoint
CREATE POLICY "booking_payments_tenant_isolation" ON "booking_payments" AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
