# `@eleva/video`

Daily.co boundary (ADR-018). Standard Daily domain, recording off. Room names are `eleva-{bookingId}`.

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

Rooms set `enforce_unique_user_ids`: a second join with the same token
`user_id` ejects the earlier copy (Daily last-join-wins).

## Live transcript

Only on the expert's call, and only when the member has an active
`ai_processing` consent (the join API returns `transcriptionAllowed`).
Daily runs Deepgram inside the EU (`transcription_geo: "eu"`); recording
stays off. `client/transcription-settings.ts` is the single source of
truth for the model and language:

| Tier      | Deepgram call                                        | When                                                               |
| --------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| `medical` | `nova-3-medical` + `language=multi`                  | Default for en, es, fr, de, hi, ru, pt, ja, it, nl                 |
| `general` | `nova-3` + `language=multi` + `language_hint=<lang>` | Other booked languages; first fallback when Daily reports an error |
| `legacy`  | `nova-2` + one fixed language (`pt` → `pt-PT`)       | Last fallback                                                      |

- The booked language (`bookings.language`, returned as `sessionLanguage`)
  picks the starting tier and the hint. Deepgram documents `language_hint`
  for `nova-3` only, so the medical model gets none; hints outside
  Deepgram's list would reject the stream, so only listed codes are sent.
- The expert can switch between **Detect automatically** and **English
  only** (`nova-3-medical` + `en`, Deepgram's advice for English-only
  audio). Daily cannot change a running transcript, so a switch stops it
  and starts again. After a run of English-only lines the call suggests
  the switch; the expert decides.
- With `includeRawResponse`, each line carries Deepgram's detected
  `languages`; the call shows the recent dominant one.
- Speaker names come from Daily's `participantId`. Before the first line
  of each start, a bracketed line such as `[Live transcript · language
detected automatically · medical vocabulary]` records what produced the
  lines that follow, inside the encrypted record.
- Fallbacks live in `client/transcription-controller.ts` (plain TypeScript,
  unit-tested with a fake Daily): a model that never produced a line steps
  down a tier on a Daily error; one that has produced lines retries itself
  (up to 2 times between lines) before stepping down.
- Real time only: nothing is recorded. Transcribing a recording after the
  call is a later founder/DPO decision (decision log 2026-11-10).
- Daily 0.93 `startTranscription` / `stopTranscription` return
  `undefined`; call them through `runDailyMethod()`.

`payment.failed` and a **full** `refund.succeeded` before `startAt` cancel
the session and delete the room. Partial refunds and the same events after
`startAt` leave the session row intact.

Daily sends `meeting.ended` soon after the last person leaves. That closes
a session only when it happened: the booked end has passed and expert and
member were in the room together for at least two minutes (`ended`,
attendance `both`). Otherwise the room has only emptied: the session goes
back to `scheduled` and stays joinable. A sweep after the join window
closes (`endsAt + 30m`) closes whatever is still open from the participant
history, and it is the only place a `no_show` is declared (empty history →
`nobody`). Attendance exists only for online sessions: a phone or in-person
session is closed as `ended` with no attendance, never as a no-show.
No-show policy (refund/keep) is not decided here. Rules:
`packages/workflows/src/video/attendance.ts`.

Never log `DAILY_API_KEY` or meeting tokens. CI runs `pnpm check:no-phi-logs`
as a best-effort grep (compact JWT literals, `token` fields on `ctx.emit`
payloads, join-URL query params, log calls that mention a meeting token).
Observability already redacts JWTs. The grep does not cover other
audit-writing paths. Do not treat it as the only control.

Phase 09 engineering is on main against **standard Daily**. The 09.0
Prebuilt probe PASS 2026-10-08 (recording off). Staging
Eleva join-page two-browser and Daily webhook subscription (secret is
on Vercel; subscribe after `elevacare-api` redeploy) are still leftover.
Eleva is EU-focused: copy describes what the video setup does (private
calls, recording off) and never names US-only frameworks (decision log
2026-11-07).
