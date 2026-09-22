# @eleva/notifications

Lane 1 transactional notifications and Lane 2 marketing stub.

`sendNotification` claims a `notification_deliveries` row (INSERT
`queued` with `lease_owner` + `claimed_at`) before calling Resend or
inserting an in-app inbox row. Resend is an idempotent provider
submission: `Idempotency-Key` is the delivery row id (24 h dedupe) plus
a `deliveryId` tag. The Resend message id is written to `provider_id`
immediately after accept, before the CAS complete, so a lost lease after
24 h adopts the stored id instead of listing the account. List/get
adoption remains a fallback for rows that never persisted the id.
Completion is compare-and-swap on `lease_owner` + `claimed_at` so a
worker whose lease was taken over never overwrites the newer result.

`invoice.issued` / `invoice.failed` stay off `NOTIFICATION_KINDS`. This
package does not POST TOConline, attach a PDF, or Comunicar TEST.

Closed-gate invoice emails (`invoice.blocked` / `invoice.skipped` /
`invoice.pending`) still send through `sendClosedGateInvoiceNotification`.
Better Auth callbacks send through `createAuthMailer()` injected at API
startup (`setAuthTransactionalMailer`). `@eleva/auth` never imports this
package. Booking / payment / payout fan-out and 24h/1h reminders are
live. SMS sends through Twilio EU (`ie1` / `dublin`) only when the
member has a verified phone and the category SMS preference is on.
StatusCallback is `POST /webhooks/twilio/status`; the signature URL is
rebuilt from server-only `API_URL` plus the raw query string. Phone
opt-in is `POST /me/phone/verify-start` and `verify-confirm` (6-digit
OTP, 10 min, hashed). Inbox is `GET /notifications`, `POST
/notifications/{id}/read`, and `POST /notifications/read-all` (owner RLS,
`notification.updated`). NavBell polls unread count every 30s. Resend
delivery events land on `POST /webhooks/resend` (Svix
`RESEND_WEBHOOK_SECRET`): `email.delivered` / `email.bounced` /
`email.complained` update `notification_deliveries`; permanent bounce
and complaint upsert `email_suppressions`.

## Lane 2 (marketing stub)

- `syncMarketingContact({ userId, orgId? })` — Neon → Resend one-way
  contact sync. Upserts only `email` / first name / `locale` when
  account-scope `marketing` consent is active; deletes the Resend
  contact on withdraw. Optional
  `RESEND_MARKETING_SEGMENT_ID` (preferred) or legacy
  `RESEND_AUDIENCE_ID`. `PUT /me/consents` awaits sync for
  `kind=marketing` (502 on provider failure so clients retry the
  idempotent PUT).
- `triggerAutomation({ event, userId, marketingPayload? })` — derives
  `first_name` / `locale` from the Neon user row; caller may only pass
  closed `plan_tier` + `generic_booking_count`. Then
  `resend.events.send`. Automations stay dashboard-seeded; domain
  fan-out to this entrypoint is post–Phase 08.
