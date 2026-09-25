# Phases 01–08 implementation audit

Date: 2026-09-25  
Scope: code on `main` at `68ea4dd0` versus `docs/eleva-v3/execution-plan/phases/01`–`08`  
Method: acceptance-matrix review + line-level confirmation of money, booking, invoicing, and notification paths. Staging smokes (W3) not yet run.  
Hard limits still in force: no production mutation; `issueInvoice()` stays closed; D-gates are reported, not closed by engineering.

## Executive summary

Phases 01–08 are **engineering-mostly-on-main**, not **production-ready**. The pipeline on GitHub main is green. The code is not safe to take live money or to treat as closed for Phase 09.

The single production blocker:

- **AUD-001 (P0).** Member cancel and account-deletion mark `booking_payments.status = refund_pending` and then stop. Nothing executes the Stripe refund. `executeTransfer` never looks at payment or booking status, so the expert can still be paid for a cancelled session.

Phase 09 implementation needs all of: the founder-approved fix pack (AUD-001, 002, 003, 008, 009, 013) merged; FT POST / Comunicação / `invoice.issued` open, or a separate founder waiver naming all three; and D-07 (Daily HIPAA/BAA/DPA) signed by founder + DPO. The 04B human-evidence waiver covers none of these. Only the docs/evidence 09.0 spike may start earlier (see Phase 09 readiness).

## W0 — Baseline pipeline

| Check                                                            | Local 2026-09-25                                                 | CI on `main` @ `68ea4dd0`                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                                 | pass                                                             | pass                                                                                 |
| `check:api-first-actions`                                        | pass                                                             | pass                                                                                 |
| `check:route-guards`                                             | pass                                                             | pass                                                                                 |
| `check:i18n-parity`                                              | pass                                                             | pass                                                                                 |
| `pnpm lint`                                                      | pass                                                             | pass                                                                                 |
| `pnpm typecheck`                                                 | **fail** (`apps/api` `.next/dev/types/routes.d.ts` parse errors) | [pass](https://github.com/rodrigobarona/elevacare-monorepo/actions/runs/36165042911) |
| `pnpm test`                                                      | **fail** (timeouts)                                              | pass                                                                                 |
| `pnpm build`                                                     | pass                                                             | pass                                                                                 |
| e2e-smoke                                                        | not re-run locally                                               | [pass](https://github.com/rodrigobarona/elevacare-monorepo/actions/runs/36165042684) |
| Opt-in e2e (`E2E_MEMBER`, `E2E_EXPERT_OFFER`, `E2E_LIVE_STRIPE`) | not re-run                                                       | not in default CI                                                                    |

Local typecheck failure is a generated `.next/dev` artifact, not a repo source error — CI typecheck is green. Local test failures are 5–6s timeouts under a full-monorepo parallel run:

- `@eleva/scheduling` `100 concurrent reservation attempts produce exactly one winner`
- `@eleva/scheduling` `maps PostgreSQL 23P01 to conflict`
- `@eleva/db` `findExpertByUsername short-circuits reserved names`
- `@eleva/db` `getExpertProfileByUserId returns null when no profile found`

Treat these as **local-contention flakes until re-run in isolation**. If they fail isolated, they become AUD items.

## Phase closeout (honest stamps)

| Phase             | Engineering              | Evidence                                                                   | Stamp                                                        |
| ----------------- | ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 01 Rebaseline     | On main                  | CI jobs exist; audit migrations exist                                      | Engineering closed                                           |
| 02 Better Auth    | On main                  | Auth e2e present; D-13 working pre-launch                                  | Engineering closed; cookie/CSRF not a prod security sign-off |
| 03 WorkOS removal | On main with leftovers   | Calendar OAuth/busy still unproven (04B waiver)                            | Engineering closed with hygiene leftovers                    |
| 04 Public booking | On main                  | Funnel e2e mostly mocked; live Stripe opt-in                               | Engineering closed; **busy + hold-sweep incomplete**         |
| 04B Offer builder | On main                  | Founder waived all human evidence 2026-09-25                               | **Waived / unproven** (not a Phase 09 blocker)               |
| 05 Member app     | On main                  | Loopback e2e opt-in                                                        | Engineering closed **except money leg depends on AUD-001**   |
| 06 Payments       | Machinery on main        | Live pay→transfer→payout **unproven**; acceptance boxes unticked           | **Gated / evidence-incomplete**; P0 refund gap               |
| 07 Invoicing      | Closed-gate code on main | Live FT / Comunicação / `invoice.issued` blocked                           | **Gated** (correct)                                          |
| 08 Notifications  | Lane 1 on main           | Twilio US1 trial proven; IE1 residency unproven; quiet hours + ICS missing | Engineering **partial**                                      |

## Findings register

Severity: **P0** blocks any production money. **P1** must be fixed or explicitly waived before Phase 09. **P2** before launch. **P3** hygiene.

| ID      | Sev | Finding                                                                                                                                                             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Fix slice                                                 |
| ------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| AUD-001 | P0  | Cancel / delete-account set `refund_pending` and never refund. Payout still proceeds.                                                                               | Writers: [`packages/scheduling/src/member-booking.ts`](../../../packages/scheduling/src/member-booking.ts) L137, [`packages/compliance/src/account-deletion.ts`](../../../packages/compliance/src/account-deletion.ts) L251. Sole `refundBookingPayment` caller: staff [`apps/api/src/app/payments/[bookingPaymentId]/refund/route.ts`](../../../apps/api/src/app/payments/[bookingPaymentId]/refund/route.ts). No workflow consumer. [`executeTransfer`](../../../packages/billing/src/server/payouts.ts) L512–539 checks `scheduled` + charge id only. OpenAPI promises Phase 6 executes the refund ([`openapi.ts`](../../../apps/api/src/lib/openapi.ts) L2971, L3082). | `fix/audit-001-refund-pending-sweep`                      |
| AUD-002 | P1  | Public slots ignore external calendar busy.                                                                                                                         | [`slots/route.ts`](../../../apps/api/src/app/public/experts/[username]/event-types/[slug]/slots/route.ts) L103–107 calls `emptyBusyTimeProvider`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `fix/audit-002-slots-external-busy`                       |
| AUD-003 | P1  | Hold-expiry sweep is a status flip only. No MB WAY `processing` skip, no PaymentIntent cancel, no `booking_links.use_count` release, no `intent_pending` reconcile. | [`slot-reservation-expiry.ts`](../../../packages/workflows/src/scheduling/slot-reservation-expiry.ts) L20–43.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `fix/audit-003-hold-expiry-sweep`                         |
| AUD-004 | P1  | Quiet hours stored, never applied. Phase 08 exit gate claims them.                                                                                                  | Prefs persist `quietHours*`; no read in `packages/notifications` or `packages/workflows`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `fix/audit-004-quiet-hours`                               |
| AUD-005 | P1  | ICS attachments are no-op stubs. Confirm/reschedule/cancel emails have no calendar file; expert-without-calendar fallback is silently dropped.                      | [`ics-email.ts`](../../../packages/workflows/src/scheduling/ics-email.ts) L24–43.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `fix/audit-005-ics-attachments`                           |
| AUD-006 | P1  | Stripe↔TOConline reconciliation compares `expert_invoices` (Tier 2), not platform-fee invoices minus credit notes.                                                  | [`reconciliation.ts`](../../../packages/accounting/src/reconciliation.ts) L285–298.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `fix/audit-006-fee-reconciliation`                        |
| AUD-007 | P1  | Payouts never wait for a platform-fee invoice `issued`. Plan text claims they do. Adding the gate while issuance is closed would freeze every payout.               | [`payouts.ts`](../../../packages/billing/src/server/payouts.ts) L512–545 vs phase 06/07 docs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **Waived** 2026-09-25 until issuance opens (decision-log) |
| AUD-008 | P1  | Transfer idempotency remint after a missed metadata lookup can double-transfer under overlapping QStash runs.                                                       | [`payouts.ts`](../../../packages/billing/src/server/payouts.ts) L51–99, L560–590.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `fix/audit-008-transfer-claim-no-remint`                  |
| AUD-009 | P1  | Payout created from full gross; out-of-order refund/dispute before the row exists is ignored. Dispute-lost row written only if a payout already exists.             | [`createPayoutStateForPaidPayment`](../../../packages/billing/src/server/payouts.ts); [`refunds.ts`](../../../packages/billing/src/server/refunds.ts) ~L811.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `fix/audit-009-payout-create-honours-refunds`             |
| AUD-010 | P2  | Workflow/cron Bearer compare is not constant-time; QStash signature only on `domain-events-publisher`.                                                              | [`internal-workflow.ts`](../../../apps/api/src/lib/internal-workflow.ts) L18.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `fix/audit-010-workflow-auth`                             |
| AUD-011 | P2  | TOConline token refresh has no single-flight lock; error bodies logged.                                                                                             | [`adapters/toconline/index.ts`](../../../packages/accounting/src/adapters/toconline/index.ts) ~L304–379.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `fix/audit-011-toconline-refresh-lock`                    |
| AUD-012 | P2  | Missing `POST /accounting/disconnect` and staff `POST /invoicing/platform-fee/[id]/retry`.                                                                          | No routes under `apps/api`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `feat/audit-012-accounting-disconnect-retry`              |
| AUD-013 | P2  | Platform-fee insert on `payment_intent.succeeded` is outside the ledger tx and errors are swallowed.                                                                | [`webhook.ts`](../../../packages/billing/src/server/webhook.ts) ~L1491–1506.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `fix/audit-013-fee-row-same-tx-or-sweep`                  |
| AUD-014 | P2  | No RLS isolation tests for Phase 05–08 tables (live suite only `org_data_keys`, opt-in).                                                                            | [`rls-isolation.test.ts`](../../../packages/db/src/__tests__/rls-isolation.test.ts).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `test/audit-014-rls-isolation-money-privacy`              |
| AUD-015 | P2  | No template PHI lint; Resend has no durable `svix-id` dedupe.                                                                                                       | `apps/email/scripts/` absent; [`handle-resend-webhook.ts`](../../../packages/notifications/src/handle-resend-webhook.ts).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `fix/audit-015-template-lint-svix-dedupe`                 |
| AUD-016 | P2  | `account.updated` webhook uses stale event payload (no retrieve). `payout.paid` dropped while held.                                                                 | [`webhook.ts`](../../../packages/billing/src/server/webhook.ts); `markPayoutPaidOut`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `fix/audit-016-connect-payout-webhooks`                   |
| AUD-017 | P2  | BotID fail-open when package/env missing.                                                                                                                           | [`bot-protection.ts`](../../../apps/api/src/lib/bot-protection.ts).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `fix/audit-017-botid-fail-closed-prod`                    |
| AUD-018 | P2  | ~16 OpenAPI gaps (workflows/cron, accounting callback/status, DSAR file, blob upload).                                                                              | [`openapi.ts`](../../../apps/api/src/lib/openapi.ts).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `fix/audit-018-openapi-coverage`                          |
| AUD-019 | P3  | `legacy-idp-guard` matches `packages/editor/eslint.config.js` ban string. Empty `infra/workos/` husk. No eslint ban for `lucide-react` / `@phosphor-icons/react`.   | CI guard; `infra/workos/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `chore/audit-019-hygiene`                                 |
| AUD-020 | P3  | Planned unit tests missing: `keys.test.ts`, `records.test.ts`, `credential-manager.test.ts`.                                                                        | Only [`envelope.test.ts`](../../../packages/encryption/src/envelope.test.ts).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `test/audit-020-encryption-calendar-units`                |
| AUD-021 | P3  | `PASSKEY_ORIGIN` defaults to `BETTER_AUTH_URL` (API origin).                                                                                                        | [`auth.ts`](../../../packages/auth/src/server/auth.ts).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirm env in staging; fail boot if unset in prod        |
| AUD-022 | P3  | Moloni adapter stub (UI disabled). Team app has no notifications page. Session detail has no invoice status. `ADMIN_DUAL_CONTROL_REFUND_CENTS` unused.              | Various.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Phase 11/12 or backlog                                    |
| AUD-023 | P3  | Guest checkout bypasses `assertMemberCanBook` (same email as a deletion-blocked member).                                                                            | [`payments/intent/route.ts`](../../../apps/api/src/app/payments/intent/route.ts).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `fix/audit-023-guest-bookability`                         |

### Rejected candidates

| Candidate                                                   | Verdict        | Why                                                                                                   |
| ----------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `account-deletion.ts` writes without `withAudit`            | Rejected       | Uses `withPlatformAudit` on every write.                                                              |
| `verify-phone.ts` entirely unaudited                        | Partial reject | start/confirm audited; attempt counter is not (folded into AUD-015/hygiene).                          |
| Consents RLS `tenant-owned` vs planned `owner-user-visible` | Still open     | Needs a dedicated policy read in W2; not confirmed as a leak.                                         |
| QStash signature required on every workflow                 | Softened to P2 | Orchestration spec allows Bearer `WORKFLOWS_DRAIN_SECRET`; still needs timing-safe compare (AUD-010). |

## Phase 01 — Rebaseline

| Criterion                                                                    | Status      | Evidence                                                          |
| ---------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| Handbook WorkOS-as-decision gone (historical only)                           | Implemented | Handbook rewrite; execution-plan blast-radius retained on purpose |
| ADR-017..021 + ADR-023 accepted                                              | Implemented | `docs/eleva-v3/adrs/`                                             |
| CI: lint/typecheck/build/test/e2e-smoke/i18n/gitleaks                        | Implemented | `.github/workflows/ci.yml`, `e2e.yml`                             |
| Neon branch + RLS class suite                                                | Partial     | Workflow exists; live isolation is opt-in and narrow (AUD-014)    |
| Audit migrations + journal                                                   | Implemented | `packages/db/src/migrations/audit/`                               |
| Cursor rules `better-auth` / `daily-video` / `encryption`; no `workos-*.mdc` | Implemented | `.cursor/rules/`                                                  |
| `security-traceability.md`                                                   | Implemented | `docs/eleva-v3/security-traceability.md`                          |
| Env: `BETTER_AUTH_*`, `ELEVA_KEK_V1`                                         | Implemented | `.env.example`                                                    |

## Phase 02 — Better Auth

| Criterion                                                                            | Status                            | Evidence                                                  |
| ------------------------------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------- |
| Spike report                                                                         | Implemented                       | `docs/eleva-v3/spikes/02-better-auth.md`                  |
| Server + plugins (org/admin/2FA/passkey/magic/bearer/jwt/apiKey/openAPI/nextCookies) | Implemented                       | `packages/auth/src/server/auth.ts`                        |
| Boundary: only `packages/auth` imports `better-auth`                                 | Implemented                       | eslint boundaries                                         |
| `/auth/*` + `/auth/ok`                                                               | Implemented                       | `apps/api/src/app/auth/`                                  |
| `requireApiAuth` 4 modes + ambiguous + CSRF + tossed cookie                          | Implemented                       | `packages/auth/src/server/{api-auth,credentials,csrf}.ts` |
| Personal Space + active org backfill                                                 | Implemented                       | provision hook + session hook                             |
| Account UI (login/signup/2FA/passkey)                                                | Implemented                       | `apps/account`                                            |
| D-13 cookie/CSRF model                                                               | Implemented as working pre-launch | not a production security sign-off                        |
| Playwright `e2e/auth.spec.ts`                                                        | Implemented                       | present                                                   |
| Legacy expand-only                                                                   | Done then contracted in 03        | migrations 0022 → 0024                                    |

## Phase 03 — WorkOS removal

| Criterion                                                         | Status      | Evidence                                                     |
| ----------------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| Envelope encrypt/decrypt/rotate/shred                             | Implemented | `packages/encryption`                                        |
| Calendar tokens via Better Auth `getAccessToken`                  | Implemented | `packages/auth/src/provider-token.ts`                        |
| Seat sync on member hooks                                         | Partial     | member add/remove only; publish/unpublish unwired (Phase 11) |
| Legacy identity / `workos_*` columns dropped                      | Implemented | `0024_drop_legacy_identity.sql`                              |
| `infra/workos/` deleted                                           | Partial     | empty husk remains (AUD-019)                                 |
| `legacy-idp-guard` green                                          | Diverged    | matches editor ban string (AUD-019)                          |
| `keys.test.ts` / `records.test.ts` / `credential-manager.test.ts` | Missing     | AUD-020                                                      |
| Staging calendar connect                                          | Unproven    | covered by 04B waiver                                        |

## Phase 04 — Public marketplace + booking

| Criterion                                      | Status                  | Evidence                                              |
| ---------------------------------------------- | ----------------------- | ----------------------------------------------------- |
| Explorer / profile / funnel in pt/en/es        | Implemented             | `apps/web`                                            |
| DST / viewer TZ / buffers / gist exclusion     | Implemented (unit)      | `offer-slots.test.ts`; live 100-way HTTP still mocked |
| Offer fixtures Quick chat / Physiotherapy      | Partial                 | seeded funnel; UI-built waived under 04B              |
| Private link book-while-closed + exhaust + 404 | Implemented (API + e2e) | `e2e/booking-links.spec.ts`                           |
| Reserve → pay → confirm + consents             | Implemented             | BotID + rate limit + Zod on public POSTs              |
| Guest user + magic link reuse                  | Implemented             | reserve path                                          |
| Expiry sweep skips MB WAY `processing`         | **Missing**             | AUD-003                                               |
| External calendar busy in public slots         | **Missing**             | AUD-002                                               |
| `/pt-BR` 301 + legacy URLs                     | Implemented             | `e2e/legacy-urls.spec.ts`                             |
| `check:route-guards` in CI                     | Implemented             |                                                       |
| Lighthouse ≥90                                 | Unproven                | not wired                                             |
| Legal/marketing parity                         | Partial                 | draft banners still ship                              |

## Phase 04B — Expert offer builder

Engineering items ticked in the phase file are accurate. Human-evidence items stay **waived/unproven**. Additional engineering notes:

- Dedicated `/locations` and `/availability` pages are partial (schedule page + inline location create).
- Field-level invariant sentences next to controls are incomplete (API refuses; UX copy not finished).
- Calendar busy is wired in expert UI but **not consumed by the public slots route** (AUD-002) — the 04B waiver does not make empty busy safe.

## Phase 05 — Member app

Surfaces, DSAR, consents, cancel policy, and IDOR scoping look implemented. The money leg of cancel/deletion is AUD-001. D-12 is founder working default only; DPO/legal re-sign was due 2026-09-25.

## Phase 06 — Payments and payouts

Machinery (Connect Express, SCT transfers, commission SSOT, refund/reversal functions, webhook event SSOT + parity test, QStash payout schedules) is on main. Acceptance boxes in the phase file are **unticked** and there is **no live pay→transfer→payout evidence**. D-03–D-06 are working pre-launch (D-03 also accountant-approved with conditions); re-sign dates 2026-09-21 have passed.

Critical defects: AUD-001, AUD-008, AUD-009. No payout-ledger↔Stripe-balance reconciler (only the mis-aimed TOConline job, AUD-006).

## Phase 07 — Invoicing

`issueInvoice()` is unconditionally closed (`isV1SalesDocumentPostAllowed` always false; flag is not a bypass). IVA matrix follows the 2026-09-15 accountant conditions. Moloni is a stub and disabled in the UI. Live FT / Comunicação / `invoice.issued` stay gated.

Defects: AUD-006 (deferred), AUD-007 (waived), AUD-011, AUD-012, AUD-013.

## Phase 08 — Notifications

Lane 1 send/claim/lease, Resend + Twilio, reminders T-24h/T-1h with cancel skip, inbox + NavBell, Lane 2 stub, and closed-gate invoice kinds are on main. `invoice.issued` / `invoice.failed` are correctly absent from `NOTIFICATION_KINDS`.

Defects: AUD-004 (quiet hours), AUD-005 (ICS), AUD-015 (PHI lint / svix dedupe). Twilio IE1 residency still operator-gated.

## W3 — Staging smokes (not started)

Required before any “closed” stamp on 04/05/06:

1. Auth: signup, magic link, 2FA, passkey, org switch, sign-out-everywhere.
2. Funnel: reserve → card + MB WAY test → webhook confirm → email + in-app.
3. Cancel a paid booking ≥24h out and prove Stripe refund + payout hold (AUD-001 acceptance).
4. Expert: Connect test account, publish, private-link book.
5. Transfer in test mode; refund after transfer; dispute test card.
6. Reminders on a short-lead booking; cancel skips send.
7. DSAR zip from private blob; delete-account 409 on reserve.
8. TOConline TEST OAuth only — no Comunicação.

## Founder triage (2026-09-25)

Approved pack, recorded in [`decision-log.md`](../decision-log.md) ("Phases 01–08 audit triage"):

| ID                                        | Disposition                                                                                                        | Where                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| AUD-001, AUD-008, AUD-009, AUD-013        | **Fix before Phase 09 implementation**                                                                             | Billing PR                       |
| AUD-002                                   | **Fix before Phase 09 implementation**                                                                             | Slots PR                         |
| AUD-003                                   | **Fix before Phase 09 implementation**                                                                             | Hold-sweep PR                    |
| AUD-007                                   | **Waived** while `issueInvoice()` is closed. The PR that opens issuance adds the skip-transfer-until-issued check. | Decision-log; phase 06 checklist |
| AUD-004                                   | **Deferred** to Phase 13                                                                                           | Phase 08 acceptance              |
| AUD-006                                   | **Deferred** to the PR that opens issuance                                                                         | Phase 07 scope                   |
| AUD-005, AUD-010–AUD-012, AUD-014–AUD-023 | Not in this pack; schedule per the recommendation (before 09 join pages, Phase 13, or before launch)               | This register                    |

## Phase 09 readiness

- **Phase 09.0** (Daily account spike, docs and evidence only) may start as soon as D-07 is in motion. This carve-out does not change any other Phase 09 gate.
- **Phase 09 implementation** needs all of the following. The Phase 07 gate row still applies unchanged.
  - AUD-001, 002, 003, 008, 009 and 013 merged, and a paid-then-cancelled booking proven on staging (refund issued, payout not transferred).
  - FT POST / Comunicação / `invoice.issued` open, or a separate founder waiver naming all three. They stay closed today.
  - D-07 (Daily HIPAA/BAA/DPA) signed by founder + DPO. The 04B human-evidence waiver does not cover it.
