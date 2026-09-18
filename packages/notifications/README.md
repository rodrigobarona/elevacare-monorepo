# @eleva/notifications

Lane 1 transactional notifications.

Closed-gate invoice emails (`invoice.blocked` / `invoice.skipped` /
`invoice.pending`) already send through Resend to expert-org operators.
This slice adds the Lane 1 tables and the closed `NOTIFICATION_KINDS`
union used by later `sendNotification` PRs.

`invoice.issued` / `invoice.failed` stay off the union until live FT
issuance exists. This package does not POST TOConline, attach a PDF, or
Comunicar TEST.

Later Phase 8 PRs: `sendNotification` claim/lease, auth mailer rewire,
booking/payment/payout fans-out, SMS, in-app API, Resend webhooks.
