# Spike 09.0 — Daily account position (standard mode)

**Status:** Standard Daily is the Phase 09 engineering baseline and the
intended EU setup. Recording off.
**Date:** 2026-10-07
**Owner:** founder (Rodrigo). DPO/legal review of this written position is
the next human step, not a claim that review already happened.
**Daily account pre-check:** **PASS (standard Prebuilt probe, 2026-10-08).**
This file records the founder decision (standard mode) **and**
the first live room. It is **not** D-07, **not** an Eleva join-page proof,
and **not** a webhook proof. The `sessions.eleva.care` CNAME is deferred. Webhook secret + Eleva two-browser join stay
operator leftovers.

## Why this spike exists

Phase 09 originally required D-07 (a special Daily plan tier and its
agreement) before implementation. On 2026-10-07 the founder deferred D-07 so
the running product can be shown to accounting and legal. D-07 was dropped
on 2026-11-07. This file is the
09.0 evidence record for that choice. It is **not** D-07 sign-off.

## Position (show this to legal)

| Claim                                      | Stamp                                             |
| ------------------------------------------ | ------------------------------------------------- |
| Daily is the only video vendor (ADR-018)   | Active                                            |
| Recording / transcripts                    | **Off** (Phase 16.8 + D-08 still required)        |
| EU media residency as Eleva-controlled     | **No stronger claim than Daily's docs**           |
| `/trust` and legal pages                   | Stay draft-bannered until D-12                    |
| Online rooms for confirmed `mode = online` | Phase 09 engineering may proceed                  |
| Production PHI-video on Daily              | **Blocked** until approved (`legal/dpia.md` §2.6) |
| Phone / in-person bookings reach Daily     | Never                                             |

## Account mode for Phase 09

Use a **standard** Daily domain.

Consequences vs the original design in
[`09-video-daily.md`](../execution-plan/phases/09-video-daily.md):

- Custom room names are allowed. Prefer a deterministic name
  `eleva-{bookingId}` so `ensureSessionRoom` can GET-or-create without the
  fingerprint/`nbf`+`exp` offset dance.
- Still: `privacy: "private"`, meeting tokens with `room_name` always set,
  `enable_recording: false`, `enable_recording_ui: false`,
  `start_cloud_recording: false`, `eject_at_room_exp: true`.
- Tokens stay in memory on the join page. Never in URLs, logs, audit
  payloads, or columns.
- `geo` may be set to an EU region when Daily documents the value; do not
  print a stronger residency claim on `/trust`.

Daily REST (`POST /rooms`, `POST /meeting-tokens`) is unchanged. Always
set `properties.room_name` on tokens so a token cannot open every room on
the domain.

## 09.0 addendum — live probe (2026-10-08)

Standard domain `elevacare.daily.co`. Recording off.
Billing unlocked the room quota (dashboard **Max 100,000 rooms**; the
previous 50 was the unpaid cap). Probe room
`eleva-97fc22a0-583d-424a-9dc7-c7742167192f` was created via REST
`POST /rooms` (private, `max_participants: 2`,
`enforce_unique_user_ids: true` after the unique-id patch). Two browsers
joined the **Daily Prebuilt** mint URL (`?t=`). Daily session analytics
showed 2 participants, 8 min, 0% packet loss, status Ended. Tokens in
that probe were a REST meeting-token leftover — production mints per
Eleva user at `POST /sessions/{bookingId}/join` and never puts `?t=` in
email.

Leave the probe room until the founder says delete. The June 2025
dashboard leftover `ie7QDEIeB1apQkkBmsqP` is not an Eleva booking name.

## What 09.0 did **not** gather

**Still pending for the Phase 09 exit gate (not this probe):**

1. Staging webhook `https://api.dev.eleva.care/webhooks/daily`.
   `DAILY_WEBHOOK_SECRET` is on Vercel `elevacare-api` (2026-10-08).
   Daily `GET /webhooks` is still empty until `elevacare-api` is
   redeployed (handshake `{ "test": "test" }` 401s until the secret is
   on the running deploy) and the webhook is created with that hmac.
2. Two-browser join on **Eleva pages** (expert
   `/expert/sessions/{id}/join` + member `/{org}/sessions/{id}/join`), not
   `elevacare.daily.co?t=`.

**Still later:** custom domain `sessions.eleva.care` CNAME (deferred).

## Tax / issuance (accountant)

This spike does **not** open FT POST, Comunicação, or `invoice.issued`.
`issueInvoice()` stays closed. Accounting reviews the closed-gate product.

## Next engineering slice

Staging webhook + Eleva two-browser join pages. Recording stays off.
Do not start Phase 10 notes or 16.8 transcripts.
