-- ADR-026 decision 10: an expert closes a practice; nobody deletes one.
-- closed_at hides the profile, its services and new bookings from every
-- public query (publiclyVisibleExpert) while invoices, payouts, the audit
-- trail and session records stay. The username stays held because the row
-- stays. Reopening clears it.
ALTER TABLE "expert_profiles" ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone;
