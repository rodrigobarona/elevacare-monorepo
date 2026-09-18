# @eleva/notifications

Lane 1 transactional notifications. This slice registers the
`send-notification` handler for closed-gate invoice events only:

- `invoice.blocked`
- `invoice.skipped`
- `invoice.pending`

It sends expert-org operator email through Resend using `@eleva/email`
templates and Phase 5 `notification_preferences` (`payment` is required
and cannot be turned off at send time). It does **not** send
`invoice.issued` / `invoice.failed`, attach a PDF, or call TOConline.

The full `sendNotification({ kind, recipient, ... })` contract, SMS,
in-app inbox, and remaining kinds land in later Phase 8 PRs.
