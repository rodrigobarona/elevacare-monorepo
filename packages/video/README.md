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

If Daily never sends `meeting.ended`, a sweep after the join window
closes (`endsAt + 30m`) finalizes `attendance` from participant history
(empty → `nobody` / `no_show`). No-show policy (refund/keep) is not
decided here.

Never log `DAILY_API_KEY` or meeting tokens. CI runs `pnpm check:no-phi-logs`
as a best-effort grep (compact JWT literals, `token` fields on `ctx.emit`
payloads, join-URL query params, log calls that mention a meeting token).
Observability already redacts JWTs. The grep does not cover other
audit-writing paths. Do not treat it as the only control.

Phase 09 engineering is on main against **standard Daily**. The 09.0 live
probe and staging two-browser call are still PENDING operator leftovers.
Do not claim HIPAA or an executed BAA.
