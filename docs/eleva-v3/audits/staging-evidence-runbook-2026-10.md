# Staging evidence runbook (pre-launch batch)

Date: 2026-10-20  
Scope: honest exit gates for **Phase 06** (money) and **Phase 09** (video), plus optional re-runs called out in the 01–10 audit.  
Policy: **no production mutations**; staging only unless the founder explicitly approves prod. `issueInvoice()` stays closed.

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

## After evidence

- Update `docs/eleva-v3/audits/2026-10-phases-01-10-audit.md` carried-forward rows (06 exit, 09 exit, AUD-001 staging) with **staging PASS** and date — not “production ready”.
- Do **not** stamp Phase 10 closed or open live tax (`issueInvoice()`).

## Out of scope for this runbook

- TOConline Comunicação / live FT issuance (Phase 07 gated).
- 10.2b AI report drafts (AUD-032 gated).
- HIPAA / cloud recording (D-07/D-08 deferred).
