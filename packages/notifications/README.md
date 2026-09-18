# @eleva/notifications

Lane 1 transactional notifications.

`sendNotification` claims a `notification_deliveries` row (INSERT
`queued` with `lease_owner` + `claimed_at`) before calling Resend or
inserting an in-app inbox row. Resend is an idempotent provider
submission: `Idempotency-Key` is the delivery row id (24 h dedupe) plus
a `deliveryId` tag. Retries older than 24 h reconcile via `emails.list`
/ `emails.get` and adopt a matching tag instead of sending again.
Completion is compare-and-swap on `lease_owner` + `claimed_at` so a
worker whose lease was taken over never overwrites the newer result.

`invoice.issued` / `invoice.failed` stay off `NOTIFICATION_KINDS`. This
package does not POST TOConline, attach a PDF, or Comunicar TEST.

Closed-gate invoice emails (`invoice.blocked` / `invoice.skipped` /
`invoice.pending`) still send through `sendClosedGateInvoiceNotification`.
SMS / Twilio, auth-mailer rewire, booking fan-out, and Resend webhooks
are later Phase 08 PRs.
