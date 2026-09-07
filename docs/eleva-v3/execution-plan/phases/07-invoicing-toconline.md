# Phase 7 — Invoicing: TOConline Tier 1 platform-fee invoices + Tier 2 expert invoices

| Field      | Value                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branch     | `phase-07/invoicing-toconline` (split: `phase-07.1/tier1-platform-fee-invoices`, `phase-07.2/tier2-expert-adapters`)                                                                                                                                                                                                                       |
| Depends on | Phase 6 (and accountant sign-off of the IVA matrix — entry gate)                                                                                                                                                                                                                                                                           |
| Effort     | 1.5 weeks                                                                                                                                                                                                                                                                                                                                  |
| Touches    | `packages/accounting/**`, `packages/workflows/src/invoicing/**`, `packages/db/src/schema/main/{platform-fee-invoices,expert-invoices,expert-integration-credentials}.ts`, `apps/api/src/app/{accounting,invoicing,workflows}/**`, `apps/expert/**` (invoicing onboarding + session invoice status), `infra/qstash/**`, `packages/flags/**` |
| Exit gate  | Every paid booking yields (1) an Eleva -> expert TOConline invoice in series `ELEVA-FEE-{YYYY}` for the platform fee, and (2) an expert -> member invoice through the expert's connected adapter (TOConline, Moloni) or a manual-mode record with monthly SAF-T/CSV export; monthly reconciliation job flags mismatches                    |

## Why this phase exists

The user's requirement: "make an invoice via TOConline every time an expert has a payment, and
Eleva has to make an invoice for the service fees." Legally there are two invoices per booking
(ADR-013): Eleva invoices the expert for the platform fee (Tier 1, Eleva's TOConline account) and
the expert invoices the member for the service (Tier 2, the expert's own fiscal software).

## Entry gate

- IVA matrix in `payments-payouts-spec.md` signed off by the accountant (record in
  `decision-log.md` with date and name). Tier 1 code must not ship without it.
- Eleva TOConline production credentials and series `ELEVA-FEE-2026`, `ELEVA-SAAS-2026` created
  (operator task documented in `operator-tasks/`).

## Scope

In:

- `packages/accounting` restructure per `.cursor/rules/toconline-integration.mdc`:
  `src/core/` (IVA rules, VIES check with 24h cache, invoice types, credential store using
  `@eleva/encryption`), `src/eleva-platform/` (Tier 1 TOConline client: OAuth PKCE, customers,
  services, sales documents v1, PDF URL, AT communication, email), `src/expert-apps/adapters/
{toconline,moloni,manual}` implementing `ExpertInvoicingAdapter`, `src/registry.ts` kept.
- Tier 1: `issuePlatformFeeInvoice(bookingPaymentId)` — triggered when `payout_states` becomes
  `transferred` (fee is final) — creates/updates the expert as TOConline customer (NIF, address
  from `expert_profiles` + `expert_practice_location`), creates a sales document in series
  `ELEVA-FEE-{YYYY}` with one line `Platform service fee — booking #<short id>` at the applied
  fee, IVA per matrix (PT 23%; EU VIES valid -> reverse charge; non-EU zero-rated), finalizes,
  communicates to AT, emails the PDF; idempotent via `platform_fee_invoices(booking_payment_id PK,
toconline_document_id, series, number, status, issued_at, pdf_url, error)`. Credit note on
  refund/reversal (`issuePlatformFeeCreditNote`).
- Tier 1b groundwork: `issueClinicSaasInvoice(subscriptionPeriod)` table + function, triggered by
  `invoice.finalized` (activated in Phase 11).
- Tier 2: on `booking_payments.status = succeeded` -> `issueExpertServiceInvoice(bookingId)`
  dispatches to the expert's selected adapter; member fiscal data (optional NIF captured in
  member settings / at checkout), service descriptor from event type, amount = gross price; stored
  in `expert_invoices(booking_id + expert_org_id PK, adapter, external_id, status, pdf_url,
issued_at, error, attempts)`; manual mode records `status = manual_pending` and appears in the
  expert's session page + monthly export (`GET /invoicing/exports/saft?month=`, CSV + SAF-T PT
  XML skeleton).
- Credentials: `expert_integration_credentials(id, expert_org_id, provider, encrypted_payload,
status, installed_at)` encrypted with `encryptForOrg`; OAuth PKCE callback routes in `apps/api`
  (`/accounting/callback` exists — extend per provider) — redirect URI `TOCONLINE_OAUTH_REDIRECT`.
- Expert onboarding step "Invoicing" (`apps/expert`): choose Auto (connect TOConline or Moloni)
  or Manual (acknowledge legal obligation); Become-Partner cannot complete without one; session
  page shows invoice status with retry and "mark as issued manually".
- Workflows: `invoicing-retry` DLQ processor (every 30 min) and `stripe-toconline-reconciliation`
  (monthly, 1st at 05:00 Lisbon) comparing Stripe application fees per expert vs Tier 1 totals;
  mismatch > 0.1% -> BetterStack alert + `accounting_reconciliation_runs` row for admin.
- Flags: `ff.toconline_invoicing_enabled`, `ff.expert_invoicing_apps_enabled`,
  `ff.invoicing.toconline`, `ff.invoicing.moloni` via `@eleva/flags`.

Out: admin accounting UI (Phase 12, data endpoints here), clinic SaaS invoices activation
(Phase 11), Spain adapters.

## Deliverables

1. Migration: `platform_fee_invoices`, `platform_fee_credit_notes`, `clinic_saas_invoices`,
   `expert_invoices`, `expert_integration_credentials`, `accounting_reconciliation_runs`; RLS;
   audit unions (`invoice: issued|failed|credited|manual_marked`; `integration_credential:
connected|disconnected`).
2. `@eleva/accounting` code + tests (mock TOConline HTTP with recorded fixtures from
   `toconline-api-reference.md`).
3. Workflow steps + routes + QStash schedules; flags declared.
4. API: `POST /accounting/connect/[provider]`, `GET /accounting/callback` (extend),
   `GET /accounting/status`, `POST /invoicing/expert/[bookingId]/retry`,
   `POST /invoicing/expert/[bookingId]/mark-manual`, `GET /invoicing/exports/saft?month=`,
   `GET /invoicing/platform-fee?month=` (staff), `GET /accounting/reconciliation` (staff).
5. `apps/expert` invoicing onboarding + session invoice status + monthly export page.
6. Operator docs: `operator-tasks/toconline-setup.md` (series creation, OAuth app, redirect URI).

## Acceptance criteria

- [ ] Paid booking on staging -> after transfer, `platform_fee_invoices` row `issued` with
      TOConline document number in `ELEVA-FEE-2026`, PDF URL works, AT communication response
      stored (test/sandbox mode if available; otherwise a clearly separate test series).
- [ ] Refund after invoice -> credit note issued and linked.
- [ ] Expert in Auto mode (TOConline) -> `expert_invoices` `issued` with external id; Moloni path
      tested with mocked HTTP; Manual mode -> `manual_pending`, visible in session page and in the
      monthly CSV/SAF-T export.
- [ ] Expert cannot complete Become-Partner without Auto connection or Manual acknowledgment.
- [ ] Reconciliation job on a seeded month produces a run row and no false mismatch; injected
      mismatch triggers alert path (mocked).
- [ ] All TOConline calls originate from `packages/accounting` (boundary grep for
      `api33.toconline.pt` outside the package returns nothing).
- [ ] IVA matrix tests: PT NIF 23%, EU VIES-valid reverse charge with note text, EU invalid 23%,
      non-EU zero-rated.

## Tests

- vitest: IVA decision table, VIES cache, TOConline client (fixtures), idempotency on retry,
  adapter registry dispatch, manual export shape, reconciliation math.

## Docs to update

- `payments-payouts-spec.md` (Tier 1 trigger = transfer, not `settled`), `toconline-api-reference.md`
  (any verified corrections), `integration-runbooks.md` (TOConline token expiry, AT failures),
  `admin-operator-playbooks.md`, `operator-tasks/toconline-setup.md`, `feature-flag-rollout-plan.md`,
  `decision-log.md` (accountant sign-off).

## Local references

- `packages/accounting/src/**`, `.cursor/rules/toconline-integration.mdc`,
  `.claude/skills/toconline-integration/SKILL.md`, `docs/eleva-v3/toconline-api-reference.md`,
  `docs/eleva-v3/payments-payouts-spec.md` (Two-Tier Invoicing Model), ADR-013.
- `apps/api/src/app/accounting/**`, `apps/api/src/app/experts/profile/invoicing/route.ts`,
  `apps/expert/src/app/**` (onboarding steps).
- `packages/encryption` (Phase 3 API), `packages/flags/src/**`, `packages/workflows/src/**`,
  `infra/qstash/**`.
- MVP: none (invoicing was manual in the MVP).

## External docs

- TOConline API (`https://api33.toconline.pt`, OAuth `https://app33.toconline.pt/oauth`) — local
  reference doc; verify with vendor docs if reachable.
- Moloni API docs (official site).
- VIES SOAP/REST check (EU Commission docs).
- Vercel Flags `/vercel/flags`; QStash `/upstash/qstash-js`.
- SAF-T PT XML schema (Autoridade Tributária) for the export skeleton.

## Risks

- TOConline has no sandbox: use a dedicated test series and cancel documents; never issue in the
  production series from staging (env guard `TOCONLINE_SERIES_PREFIX`).
- Accountant sign-off delay blocks Tier 1: Tier 2 (07.2) can proceed in parallel.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(/Users/<you>/…/elevacare-monorepo). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (toconline-integration, api-first-agentic, audit-wiring,
   encryption, stripe-webhooks) and .claude/skills/toconline-integration/SKILL.md plus
   .cursor/skills/coderabbit-review/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/07-invoicing-toconline.md in full.
3. Read every file under "Local references" (toconline-api-reference.md end to end). Pull Vercel
   Flags, QStash docs through Context7; use the local TOConline reference for endpoints.
4. Entry gate: confirm decision-log.md contains the accountant sign-off of the IVA matrix. If it
   is missing, implement PR 07.2 first and stop before Tier 1 issuance code, reporting the block.

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-07.1/tier1-platform-fee-invoices
  (second PR: phase-07.2/tier2-expert-adapters). Each under 150 reviewable files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review -> fix -> repeat. Conventional Commits. pnpm review:branch -> fix.
- git push -u origin <branch> && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green; request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for pt/en/es, cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 7 TASK — Two-tier invoicing (ADR-013): Eleva -> expert platform-fee invoice on TOConline for
every paid booking, and expert -> member invoice through the expert's connected software.

PR 07.1 — Tier 1 (Eleva platform):
1. packages/accounting restructure: src/core/{iva.ts (decision table + tests), vies.ts (VIES
   check, 24h cache in Upstash Redis, typed result), types.ts, credentials.ts (encrypt/decrypt via
   @eleva/encryption encryptForOrg with orgId = Eleva staff org for Tier 1 or expert org for
   Tier 2)}, src/eleva-platform/toconline-client.ts (OAuth 2.0 Authorization Code + PKCE S256,
   scope commercial, token refresh, base https://api33.toconline.pt, headers per reference;
   methods upsertCustomer, upsertService, createSalesDocumentV1, finalize, getPdfUrl,
   sendToAT, emailDocument, createCreditNote), src/eleva-platform/platform-fee-invoices.ts
   (issuePlatformFeeInvoice(bookingPaymentId), issuePlatformFeeCreditNote(refundId)),
   src/eleva-platform/clinic-saas-invoices.ts (issueClinicSaasInvoice(subscriptionId, periodStart,
   periodEnd) — implemented, wired in Phase 11). Env: TOCONLINE_CLIENT_ID, TOCONLINE_CLIENT_SECRET,
   TOCONLINE_OAUTH_URL, TOCONLINE_API_URL, TOCONLINE_OAUTH_REDIRECT, TOCONLINE_SERIES_PREFIX
   (staging uses TEST-ELEVA-FEE), ELEVA_PLATFORM_NIF, ELEVA_PLATFORM_ADDRESS_*.
2. packages/db: platform_fee_invoices (booking_payment_id PK, expert_org_id, series, number,
   toconline_document_id, amount_cents, iva_rate_bps, iva_regime pt_standard|eu_reverse_charge|
   eu_standard|non_eu_zero, status pending|issued|failed|credited, pdf_url, at_status, issued_at,
   error, attempts), platform_fee_credit_notes, clinic_saas_invoices (subscription_id +
   period_start PK, ...), accounting_reconciliation_runs (month, stripe_fee_total_cents,
   invoiced_total_cents, mismatch_bps, status, details jsonb, created_at). RLS; audit unions.
3. Trigger: in @eleva/billing payouts when payout_states -> transferred, enqueue
   issuePlatformFeeInvoice via @eleva/workflows (idempotent on booking_payment_id). On refund
   with an issued invoice -> credit note. Flag gate ff.toconline_invoicing_enabled (default off;
   on for staging).
4. Workflows: packages/workflows/src/invoicing/{invoicing-retry.ts (every 30 min, processes
   failed rows with backoff, max 10 attempts then DLQ + admin flag), stripe-toconline-
   reconciliation.ts (monthly 1st 05:00 Europe/Lisbon; sum Stripe application fees per expert via
   balance transactions vs platform_fee_invoices; write run row; mismatch > 0.1% -> BetterStack
   alert through @eleva/observability)}; routes under apps/api/src/app/workflows/*; infra/qstash/
   setup-invoicing.ts + root script + setup:all.
5. API (staff capability admin_accounting:read): GET /invoicing/platform-fee?month=,
   GET /accounting/reconciliation, POST /invoicing/platform-fee/[bookingPaymentId]/retry.
   OpenAPI + client.
6. Tests: IVA decision table (PT NIF 23%, EU VIES valid reverse charge with legal note, EU invalid
   23%, non-EU zero-rated), VIES cache, client with recorded fixtures (msw), idempotent issuance,
   credit note, reconciliation math. Docs: operator-tasks/toconline-setup.md (series creation
   ELEVA-FEE-YYYY / ELEVA-SAAS-YYYY, OAuth app, redirect URI), payments-payouts-spec.md,
   integration-runbooks.md, feature-flag-rollout-plan.md, decision-log.md.

PR 07.2 — Tier 2 (expert -> member):
7. packages/accounting/src/expert-apps/adapters/{toconline,moloni,manual}: implement
   ExpertInvoicingAdapter { connect, issueInvoice, status, disconnect } (keep the existing
   registry.ts API). TOConline adapter reuses the client with the expert's tokens; Moloni adapter
   per its API (company selection, document sets); manual adapter records manual_pending and
   builds monthly CSV + SAF-T PT XML skeleton. Credentials in expert_integration_credentials
   (expert_org_id, provider, encrypted_payload, status, installed_at) encrypted per org.
8. packages/db: expert_invoices (booking_id + expert_org_id PK, adapter, external_id, number,
   amount_cents, member_nif nullable, status pending|issued|failed|manual_pending|manual_issued,
   pdf_url, issued_at, error, attempts). Member NIF: optional field on member profile (PATCH /me)
   and optional at checkout step 2 (Phase 4 form) — store on booking as buyer_tax_id.
9. Trigger: payment_intent.succeeded handler enqueues issueExpertServiceInvoice(bookingId)
   (flag ff.expert_invoicing_apps_enabled + ff.invoicing.<provider>); retries via the same
   invoicing-retry workflow; failures surface in the expert session page.
10. API: POST /accounting/connect/[provider] (starts OAuth PKCE, returns URL), GET
    /accounting/callback (extend existing for provider + state), GET /accounting/status,
    POST /accounting/disconnect, POST /invoicing/expert/[bookingId]/retry, POST /invoicing/expert/
    [bookingId]/mark-manual, GET /invoicing/exports/saft?month= (CSV + XML zip via private Blob).
11. apps/expert: onboarding step "Invoicing" (Auto: connect TOConline or Moloni; Manual:
    acknowledgment checkbox with legal text pt/en/es) required before Become-Partner completes
    (update experts/profile/steps/[step]/complete); session detail shows invoice status with
    Retry and "Mark as issued manually"; /[orgSlug]/finance/invoices lists expert_invoices with
    monthly export button.
12. Tests: adapter dispatch, PKCE flow (mocked), idempotency per booking, manual export shape.
    Docs: payments-payouts-spec.md Tier 2 section, admin-operator-playbooks.md (verify connection
    in Become-Partner review), decision-log.md.

Acceptance (paste evidence): staging booking -> Tier 1 invoice in the test series with PDF + AT
status, credit note on refund; Tier 2 issued via TOConline adapter, Moloni mocked, manual mode
export; Become-Partner blocked without invoicing choice; reconciliation run row; boundary grep
for api33.toconline.pt outside packages/accounting empty; IVA tests green.

Report: migrations, endpoints, schedules, flags, tests, CodeRabbit CLI counts, PR URLs, and the
operator tasks still pending (series, credentials, accountant sign-off).
```
