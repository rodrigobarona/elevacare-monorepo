# Staging evidence runbook (pre-launch batch)

Date: 2026-10-20  
Scope: honest exit gates for **Phase 06** (money) and **Phase 09** (video), plus optional re-runs called out in the 01–10 audit.  
Policy: default **staging only**; **dev-prod** runs on production hostnames are allowed only under the
[2026-10-21 dev-prod evidence exception](../decision-log.md) (Stripe test keys, seeded `fisiomota`, no real members).
`issueInvoice()` stays closed.

## Prerequisites

1. Staging deploy is current with `main` (including latest migrations — e.g. **0069** after AUD-028 merges).
2. Operator runs `pnpm db:migrate` against the staging Neon branch (or relies on the neon-branch CI job on the merged commit).
3. QStash schedules (`setup-all`) are applied on **staging only** when you intentionally enable them (retention sweep, CRM due digest, etc.) — not required for 06/09 exit proofs.
4. Stripe test mode, Daily standard (recording off, **not HIPAA**), Twilio as configured for staging.

## Phase 06 — pay → transfer → payout

| Step | Action                                                                                            | Pass criterion                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1    | Book paid offer on staging (e.g. seeded expert offer) through reserve → Stripe Checkout → confirm | Booking `confirmed`, payment row present                                                         |
| 2    | Wait for Connect transfer + payout machinery (webhooks)                                           | Transfer row; payout state advances per policy                                                   |
| 3    | Expert cancel with refund (Flexible/Moderate/Strict seed)                                         | Refund matches `resolveCancellationRefund()`; AUD-001 path                                       |
| 4    | Capture                                                                                           | Screenshots + Stripe dashboard IDs in this doc or linked sheet; stamp audit row **staging PASS** |

Optional: `pnpm e2e:cancellation-smoke` on staging URL (not loopback-only).

## Phase 09 — Eleva grant join + Daily webhooks

| Step | Action                                                                                          | Pass criterion                                                                            |
| ---- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1    | Two browsers: expert join URL + member grant URL (`/join/{bookingId}?g=`) within the 15m window | Both in call; display names visible                                                       |
| 2    | `POST /webhooks/daily` subscribed on staging API                                                | `meeting.started` / `participant.*` / `meeting.ended` received and persisted              |
| 3    | Overtime                                                                                        | Soft warning after booked end; room not hard-ejected at end (AUD-036)                     |
| 4    | Capture                                                                                         | Webhook delivery log + join URLs (redacted) + timestamp; stamp **exit gate staging PASS** |

Prebuilt-only Daily probe is **not** this gate (see `docs/eleva-v3/spikes/09-daily-account.md`).

## Phase 04 — booking funnel (optional same session)

| Step | Action                                   | Pass criterion                                          |
| ---- | ---------------------------------------- | ------------------------------------------------------- |
| 1    | Guest reserve → pay → confirm on staging | End-to-end without loopback                             |
| 2    | BotID                                    | Staging on; prod promotion tracked separately (AUD-017) |

## Dev-prod batch (production hostnames, Stripe test mode)

Use this section when staging W3 is unavailable but the founder exception is active. Same steps as
above; only the base URLs change (`https://eleva.care`, `https://api.eleva.care`).

| Gate             | Status (2026-10-21)      | Evidence                                                                                                                                                                        |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy freshness | **Partial**              | `x-vercel-id` present on `api.eleva.care/health` (includes `fra1`); Hobby deploy quota blocked CLI redeploy of all nine apps — retry fra1 batch after quota reset               |
| Phase 06 money   | **PENDING**              | Operator: reserve → Checkout (4242) → confirm → transfer; AUD-001 Flexible/Moderate/Strict cancels                                                                              |
| Phase 09 video   | **PENDING**              | Operator: expert join + guest `/join/{bookingId}?g=`; Daily webhook log ids                                                                                                     |
| Phase 04 guest   | **Partial** (2026-10-29) | PaymentIntent path passed on `dev.eleva.care` → `api.eleva.care`. Checkout Sessions, the path the funnel now uses, is still to run after the next deploy; note BotID prod state |

Pre-flight: confirm Stripe dashboard is **test mode**; confirm `DAILY_WEBHOOK_SECRET` on prod API before trusting webhook rows.

## Accelerated loopback evidence (2026-10-30)

Local API and app against the Neon dev branch, with Stripe test keys and a real Daily room. **This does
not close a staging or dev-prod gate.** It proves the code paths; the deployed gates above stay open.

Only the clock is shifted, and only in the local database: payout eligibility is days after a session,
and a call needs a booking inside its join window. Charges, webhooks, transfers and the Daily room are
real test-mode objects.

| Path                                      | Result      | Evidence                                                                                                                                                                                                                                                                                              |
| ----------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pay → webhook → payout → Connect transfer | **PASS**    | `pnpm e2e:payout-smoke`: €60 booking, `tr_3UW9kKGd5f3064kZ13EoUUNK`, €51 tied to the charge                                                                                                                                                                                                           |
| 10% code, Checkout funnel                 | **PASS**    | €54 charged, €51 transferred, tied to the charge                                                                                                                                                                                                                                                      |
| 20% code, Checkout funnel                 | **PASS**    | €48 charged, `tr_1UWAfkGd5f3064kZCB7i1VSb`, €51 funded from Eleva's balance                                                                                                                                                                                                                           |
| Cancellation refunds (AUD-001)            | **Partial** | Flexible €60 and Strict €0. Moderate skipped: no slot in the 25–47h window at run time                                                                                                                                                                                                                |
| Two-browser call                          | **PASS**    | `pnpm e2e:video-call-smoke` on a production build with the CSP on. Meeting `a45150f7-ef28-4cfb-a3d8-40880afa2ff2`, 2 people                                                                                                                                                                           |
| Daily webhooks → attendance               | **Partial** | Real delivery to `api.eleva.care`: webhook `729ecb66-4b90-414b-837b-b19f268e9e4a` `ACTIVE`, 0 failures, last push 2026-10-30 08:03 UTC. Those rooms exist only locally, so production ignored them as unknown. Attendance `both` came from a signed local replay. A deployed booking is still needed. |

Not proven: staff approval of a first payout (the smoke stands in for the API call), the bank payout from
the connected account, and overtime behaviour in a real call.

## After evidence

- Update `docs/eleva-v3/audits/2026-10-phases-01-10-audit.md` carried-forward rows (06 exit, 09 exit, AUD-001) with **staging PASS** or **dev-prod PASS** and date — not “production ready”.
- Do **not** stamp Phase 10 closed or open live tax (`issueInvoice()`).

## Out of scope for this runbook

- TOConline Comunicação / live FT issuance (Phase 07 gated).
- Turning on `ff.ai_reports_beta` in production (10.2b ships **off**; generation fail-closed until zero-retention model attestation).
- HIPAA / cloud recording (D-07/D-08 deferred).
