# Spike 09.0 — Daily account position (standard mode)

**Status:** Founder-deferred HIPAA path. Standard Daily is the Phase 09
engineering baseline. **Not HIPAA. BAA/DPA not executed.**
**Date:** 2026-10-07
**Owner:** founder (Rodrigo). DPO/legal review of this written position is
the next human step, not a claim that review already happened.
**Daily account pre-check:** **PASS (standard Prebuilt probe, 2026-10-08).**
This file records the founder decision (standard mode, no BAA) **and**
the first live room. It is **not** D-07, **not** an Eleva join-page proof,
and **not** a webhook proof. No HIPAA domain, no BAA packet, no
`sessions.eleva.care` CNAME. Webhook secret + Eleva two-browser join stay
operator leftovers.

## Why this spike exists

Phase 09 originally required D-07 (Daily HIPAA domain + executed BAA/DPA)
before implementation. On 2026-10-07 the founder deferred BAA and HIPAA so
the running product can be shown to accounting and legal. This file is the
09.0 evidence record for that choice. It is **not** D-07 sign-off.

## Position (show this to legal)

| Claim                                      | Stamp                                           |
| ------------------------------------------ | ----------------------------------------------- |
| Daily is the only video vendor (ADR-018)   | Active                                          |
| HIPAA-enabled Daily domain                 | **Not used**                                    |
| Daily BAA / DPA executed                   | **No**                                          |
| Product is HIPAA compliant                 | **No — do not say this**                        |
| Recording / transcripts                    | **Off** (Phase 16.8 + D-08 still required)      |
| EU media residency as Eleva-controlled     | **No stronger claim than Daily's docs**         |
| `/trust` and legal pages                   | Stay draft-bannered until D-12                  |
| Online rooms for confirmed `mode = online` | Phase 09 engineering may proceed                |
| Production PHI-video on Daily              | **Blocked** until D-07 (not only a HIPAA claim) |
| Phone / in-person bookings reach Daily     | Never                                           |

## Account mode for Phase 09

Use a **standard** Daily domain (not HIPAA mode).

Consequences vs the original HIPAA-mode design in
[`09-video-daily.md`](../execution-plan/phases/09-video-daily.md):

- Custom room names are allowed. Prefer a deterministic name
  `eleva-{bookingId}` so `ensureSessionRoom` can GET-or-create without the
  HIPAA fingerprint/`nbf`+`exp` offset dance. If D-07 is signed later,
  switch to random names and the fingerprint reconciler — do not invent
  HIPAA mode in code until then.
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

Standard domain `elevacare.daily.co`. Recording off. **Not HIPAA.**
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

**Still later, only if the founder wants HIPAA:**

1. Daily plan tier with HIPAA enabled.
2. Executed BAA/DPA (D-07).
3. Custom domain `sessions.eleva.care` CNAME.
4. Two-browser HIPAA-domain token proof.

A later 09.0 addendum can attach those without rewriting this file.

## Tax / issuance (accountant)

This spike does **not** open FT POST, Comunicação, or `invoice.issued`.
`issueInvoice()` stays closed. Accounting reviews the closed-gate product.

## Next engineering slice

Staging webhook + Eleva two-browser join pages. Recording stays off.
Do not start Phase 10 notes or 16.8 transcripts.
