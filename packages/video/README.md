# `@eleva/video`

Daily.co boundary (ADR-018). **Standard domain only until D-07.** Not HIPAA.
Recording off. Room names are `eleva-{bookingId}`.

## Exports

- `.` — server primitives: room option builder, REST rooms, self-signed
  meeting tokens (`jose` HS256). Never import this from a Client Component.
- `./webhooks` — HMAC verify + typed Daily webhook parser.
- `./client` — `<ElevaCall>` and `<JoinSession>` on `@daily-co/daily-react`.
  Meeting tokens stay in memory; never put them in a URL, log, or column.
- `./join-window` — isomorphic `[start-15m, end+30m]` helpers for Join CTAs.
- `./join-cta` — client Join button that re-evaluates the window every 30s.

Confirmation and 1h-reminder emails deep-link to Eleva join pages
(`/{orgSlug}/sessions/{bookingId}/join`, `/expert/sessions/{bookingId}/join`).
Never put a Daily room URL or meeting token in email.

`payment.failed` and a **full** `refund.succeeded` before `startAt` cancel
the session and delete the room. Partial refunds and the same events after
`startAt` leave the session row intact.

Never log `DAILY_API_KEY` or meeting tokens.
