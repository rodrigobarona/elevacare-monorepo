# Spike 09.0 — Daily account position (standard mode)

**Status:** Founder-deferred HIPAA path. Standard Daily is the Phase 09
engineering baseline. **Not HIPAA. BAA/DPA not executed.**
**Date:** 2026-10-07
**Owner:** founder (Rodrigo). DPO/legal review of this written position is
the next human step, not a claim that review already happened.
**Daily account pre-check:** **PENDING.** This file records the founder
decision (standard mode, no BAA). It is **not** a completed Daily account
probe. Implementation still needs a standard-domain `DAILY_API_KEY` /
`DAILY_DOMAIN` (recording off) before rooms can be created. No HIPAA
domain, no BAA packet, no `sessions.eleva.care` CNAME, no webhook secret
captured here.

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

## What 09.0 did **not** gather

**Pending before the first live room (standard domain):**

1. Daily standard-domain API key + domain name in env.
2. Recording confirmed off on that domain.
3. Staging webhook `https://api.dev.eleva.care/webhooks/daily` + secret.

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

`packages/video` on standard Daily: named private rooms, join tokens,
webhooks, join pages. Recording stays off.
