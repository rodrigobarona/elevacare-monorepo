# Phase 7 — Invoicing: TOConline Tier 1 platform-fee invoices + Tier 2 expert invoices

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branch     | `phase-07/invoicing-toconline` (split: `phase-07.1/tier1-platform-fee-invoices`, `phase-07.2/tier2-expert-adapters`)                                                                                                                                                                                                                                                                                                                             |
| Depends on | Phase 6 (PR 07.0 spike may start once PR 06.1 is merged); accountant 2026-09-15 written reply (**Aprovado com condições**): D-09 historical classification approved with regularization conditions; PR 07.1 automatic **production** issuance / intra-EU flows still blocked on pending fiscal-parameter confirmation — entry gate below                                                                                                         |
| Effort     | 1.5 weeks                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Touches    | `packages/accounting/**`, `packages/workflows/src/{invoicing/**,domain-events.ts}`, `apps/api/src/app/workflows/domain-events-publisher/**`, `packages/db/src/schema/main/{platform-fee-invoices,expert-invoices,expert-integration-credentials}.ts`, `apps/api/src/app/{accounting,invoicing,workflows}/**`, `apps/expert/**` (invoicing onboarding + session invoice status), `infra/qstash/**`, `packages/flags/**`                           |
| Exit gate  | Every booking paid **after cutover** (pre-cutover MVP bookings are `legacy`/`legacy_missing` rows per D-09 and never get a Tier 1 document) yields (1) an Eleva -> expert TOConline invoice in series `ELEVA-FEE-{YYYY}` for the platform fee, and (2) an expert -> member invoice through the expert's connected adapter (TOConline, Moloni) or a manual-mode record with monthly SAF-T/CSV export; monthly reconciliation job flags mismatches |

## Why this phase exists

The user's requirement: "make an invoice via TOConline every time an expert has a payment, and
Eleva has to make an invoice for the service fees." Legally there are two invoices per booking
(ADR-013): Eleva invoices the expert for the platform fee (Tier 1, Eleva's TOConline account) and
the expert invoices the member for the service (Tier 2, the expert's own fiscal software).

## Entry gate

- Accountant written reply **2026-09-15**: **Aprovado com condições** (date + name in
  `decision-log.md`; verbatim
  [`accountant-approval-2026-09-15.md`](../../accountant-approval-2026-09-15.md)). This **is**
  the accountant reply, with conditions — not a founder D-03–D-06 substitute. Automatic
  issuance may be activated only after the conditions below and confirmation of pending fiscal
  parameters. This reply does **not** authorize activating flows whose fiscal configuration is
  not yet validated.
- **IVA / settlement (D-03) — Aprovado com condições.** Commission VAT-inclusive model and
  issuance-not-tied-to-payout are **Aprovado** (100,00 € / 15,00 € / 85,00 € example; must
  appear in commercial terms). Still **blocked** for PR 07.1 automatic **production** issuance
  and for activating intra-EU flows until pending fiscal parameters are confirmed: tax codes,
  rates, legal mentions; VIES 24h cache reuse + downtime procedure; OSS classification (depends
  on service/operations — not an implemented fact); EU without a valid VIES NIF is **not**
  automatically a consumer; extra-EU is **not** an indiscriminate “zero rate”. Credit notes,
  billing data, and rounding follow the accountant conditions in `payments-payouts-spec.md`
  (credit note is not exclusively tied to technical refund success; no “single rounding” rule
  that diverges taxable base / IVA / total).
- **Historical invoices (D-09) — accountant-approved with conditions.** Migrated MVP paid
  bookings are imported with `platform_fee_invoices.status = legacy` and the MVP's invoice
  reference (`legacy_document_ref`) when one exists, `legacy_missing` when none does; v3
  **never** issues a Tier 1 document for a booking paid before cutover. Exclusion from v3
  automatic issuance does **not** waive Eleva's regularization duties. `legacy_missing` cases
  must be sent for analysis (values, dates, available documents). Regularization is a **separate
  procedure under accountant guidance**. Phase 14 consumes this rule. This does **not**
  unlock PR 07.1 automatic production issuance.
- **PR 07.1 automatic production issuance / activating intra-EU flows: STILL BLOCKED** until
  ELEVA series communication and remaining Manolo confirmation of live tax codes/rates/legal
  mentions. Founder 2026-09-17 unblocks **07.1 engineering**: schema, IVA lookups
  (`GET /taxes`), fail-closed VIES, `issuePlatformFeeInvoice` orchestration that still
  refuses v1 POST **unconditionally**. AT Comunicação stays operator-gated. **07.2 / OAuth / schema /
  TEST-series-without-issuance can continue.** Do not Comunicar TEST. Do not POST finalized
  FTs unless a later phase explicitly allows a non-AT TEST create.
- **TEST / series (accountant-approved):** do not Comunicar TEST FT/NC to AT; do not finalize
  fictitious TOConline documents; do not use ELEVA production series to simulate. Non-communication
  of TEST does not make it a fiscal test environment and does not authorize fictitious documents.
  ELEVA production series depend on legally required procedures (including series communication
  and fiscal configuration).
- **PR 07.0 spike** (`phase-07.0/spike-toconline`) completed against the Eleva TOConline account
  in a **TEST series that is never communicated to AT** (TOConline-only sandbox): current OAuth
  flow, correct API hostnames, customer + service creation, series lookup, refresh-token
  behaviour, rate limits and error semantics — evidence in `docs/eleva-v3/spikes/07-toconline.md`.
  Invoice / PDF / document AT / credit note wait for **ELEVA** at go-live. Hostnames and OAuth
  endpoints are **configuration** (`TOCONLINE_API_BASE_URL`, `TOCONLINE_OAUTH_BASE_URL`), verified
  against https://api-docs.toconline.pt during the spike, never hardcoded from historical notes.
- Eleva TOConline production credentials and series `ELEVA-FEE-2026`, `ELEVA-SAAS-2026` created
  (operator task documented in `operator-tasks/`).

## Scope

In:

- `packages/accounting` restructure per `.cursor/rules/toconline-integration.mdc`:
  `src/core/` (IVA rules per accountant 2026-09-15 conditions; VIES check at registration and
  before issuance with evidence retained — 24h cache + downtime procedure pending specific
  validation before activating intra-EU flows; invoice types; credential store using
  `@eleva/encryption`), `src/eleva-platform/` (Tier 1 TOConline client: OAuth Authorization
  Code without PKCE as proven in PR 07.0, customers,
  services, sales documents v1, PDF URL, AT communication, email), `src/expert-apps/adapters/
{toconline,moloni,manual}` implementing `ExpertInvoicingAdapter`, `src/registry.ts` kept.
- Tier 1: `issuePlatformFeeInvoice(bookingPaymentId)` — triggered by the `payment_intent.succeeded`
  handler (the fee is fixed at charge time in `booking_payments.application_fee_cents`; a later
  commission reduction or cancellation issues a credit note per accountant conditions — not
  exclusively on technical refund success) so that every paid booking gets an invoice regardless
  of payout state (`approval_required`, `held`, `failed`) — creates/updates the expert as TOConline customer (NIF, address
  from `expert_profiles` + `expert_practice_location`), creates a sales document in series
  `ELEVA-FEE-{YYYY}` with one line `Platform service fee — booking #<short id>` at the applied
  fee, IVA per the accountant 2026-09-15 matrix (Aprovado com condições — pending fiscal
  parameters; do not ship the old automatic EU-without-VIES=consumer / extra-EU zero-rate
  table), finalizes,
  communicates to AT, emails the PDF; idempotent via `platform_fee_invoices(booking_payment_id PK,
toconline_document_id, series, number, status, issued_at, pdf_url, error)`. Credit note on
  commission reduction or cancellation (`issuePlatformFeeCreditNote`), not exclusively on
  technical refund success.
- **Invoice domain events** (consumed by Phase 8) use the **transactional outbox** created in
  Phase 4 (`domain_events_outbox` — `id`, `type`, `payload jsonb`, `idempotency_key` unique,
  `created_at`, `published_at` nullable, `attempts` — plus `emitDomainEvent(tx, event)` in
  `@eleva/workflows` and the `/workflows/domain-events-publisher` route), not an in-process
  dispatcher: this phase **extends the typed event union** with the invoice events and
  `emitDomainEvent` **inserts the outbox row inside the same Drizzle transaction** as the status change of `platform_fee_invoices` / `expert_invoices`
  (so a crash between commit and publish cannot lose or double an event). Event types:
  `invoice.issued` | `invoice.failed` | `invoice.credited`; payload `invoiceKind`
  (`platform_fee` | `expert_service`), `invoiceId`, `bookingPaymentId` or `bookingId`,
  `expertOrgId`, `number`, optional `pdfUrl` / `error`; `idempotency_key` =
  `invoice:<kind>:<id>:<status>`. A publisher workflow `POST /workflows/domain-events-publisher`
  (QStash schedule every minute, plus a best-effort immediate kick via Next.js `after()`) reads
  unpublished rows, dispatches to registered subscribers, and sets `published_at`; subscribers
  must be idempotent on `idempotency_key` (Phase 8 registers `sendNotification`; until then the
  only subscriber is a structured logger). Test: replaying the same `payment_intent.succeeded`
  twice yields one invoice row and one outbox row; killing the process after commit and before
  publish still results in exactly one delivered event.
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
status, installed_at)` encrypted with `encryptForOrg`; OAuth callback routes in `apps/api`
  (`/accounting/callback` exists — extend per provider; TOConline is Authorization Code
  **without PKCE** as proven in PR 07.0) — redirect URI `TOCONLINE_OAUTH_REDIRECT`.
- Expert onboarding step "Invoicing" (`apps/expert`): choose Auto (connect TOConline or Moloni)
  or Manual (acknowledge legal obligation); Become-Partner cannot complete without one; session
  page shows invoice status with retry and "mark as issued manually".
- Workflows: `invoicing-retry` DLQ processor (every 30 min) and `stripe-toconline-reconciliation`
  (monthly, 1st at 05:00 Lisbon) comparing ledger platform fees (`booking_payments.application_fee_cents`,
  net of refunds) per expert vs Tier 1 invoice minus credit-note totals;
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

> **Closeout status (2026-09-24):** Closed-gate engineering for Phase 07 is on
> main. **Exit gate remains BLOCKED:** do not open live FT POST, do not
> Comunicar TEST, do not call `issueInvoice()` / finalize fictitious documents,
> do not invent DPO/legal production sign-off. Engineering checkboxes below may
> be met; production issuance / Comunicação acceptance is explicitly deferred.
>
> ### Founder evidence checklist (07 — blocked vs waive)
>
> | Item                                                            | Status                                                                                               |
> | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
> | Closed-gate engineering (`issueInvoice()` refuses POST)         | Shipped — keep closed                                                                                |
> | ELEVA series communication (legally required before auto-issue) | **Blocked** — operator/accountant prerequisite; not waived by founder engineering approval           |
> | Remaining fiscal params (tax codes / rates / legal mentions)    | **Blocked** — Manolo/accountant confirmation                                                         |
> | Live FT POST / Comunicação / finalize                           | **Blocked** — founder/DPO/fiscal params **and** ELEVA series communication; not waive-as-engineering |
> | Phase 09 start                                                  | **Blocked** until 01–08 closable gaps done or waived (this gate stays blocked regardless)            |

**PR 07.1 issuance is deferred.** Do not treat `issuePlatformFeeInvoice` reaching `issued`,
finalize, Comunicação à AT, or storing an AT communication response as 07.1 acceptance.
Those checks wait for confirmed fiscal parameters (tax codes, rates, legal mentions, VIES
24h cache + downtime procedure). 07.1 may land schema/adapter scaffolding that never POSTs
`/api/v1/commercial_sales_documents`.

- [ ] Paid booking on staging -> `platform_fee_invoices` row is `pending` synchronously in the
      `payment_intent.succeeded` handler. Worker POST / finalize / AT communication / `issued`
      SLA are **deferred** until fiscal params are confirmed. Retry policy (document now, do not
      run against TOConline TEST): fast stage = QStash exponential backoff up to **5 attempts**,
      then `status = failed` and alerts (Sentry + ops e-mail); slow stage: `invoicing-retry`
      (every 30 min) re-processes `failed` rows with backoff up to **10 further attempts**, then
      `status = dead_lettered`, writes `workflow_dead_letters` and raises the admin flag
      (Phase 12 queue). Payout remaining `approval_required` until a real issued fee invoice
      exists is already the Phase 6 behavior — do not simulate an issued FT to unblock it.
- [ ] Credit-note path is implemented in code and tests with the issuance gate still closed;
      do not issue or communicate a TEST NC.
- [ ] Expert in Auto mode (TOConline) -> OAuth connected, TEST series lookup,
      `issueInvoice()` refuses POST (`toconline_v1_auto_finalize_blocked`).
      `expert_invoices` may be `pending`/`failed` with the blocked code; **do
      not** POST `/api/v1/commercial_sales_documents` until fiscal params are
      signed. Moloni path tested with mocked HTTP; Manual mode ->
      `manual_pending`, visible in session page and in the monthly CSV/SAF-T
      export.
- [ ] Expert cannot complete Become-Partner without Auto connection or Manual acknowledgment.
- [ ] Reconciliation job on a seeded month produces a run row and no false mismatch; injected
      mismatch triggers alert path (mocked).
- [ ] All TOConline calls originate from `packages/accounting` (boundary grep for
      `api33.toconline.pt` outside the package returns nothing).
- [ ] IVA matrix tests match the accountant 2026-09-15 conditions (not the old automatic
      table): PT applies the legally due rate (territorial rules pending confirmation); EU
      VIES-valid B2B general rule → no Portuguese IVA / reverse charge when legal requirements
      are met; EU without valid VIES NIF is **not** auto-classified as consumer; extra-EU is
      **not** indiscriminate zero-rate. Intra-EU flow activation stays blocked until VIES 24h
      cache + downtime procedure are validated. Tax codes, rates, legal mentions pending.

## Tests

- vitest: IVA decision table, VIES cache, TOConline client (fixtures), idempotency on retry,
  adapter registry dispatch, manual export shape, reconciliation math.

## Docs to update

- `payments-payouts-spec.md` (Tier 1 trigger = charge / when commission becomes due, not
  payout; credit note on commission reduction, not exclusively refund succeeded; historical-invoice
  rule D-09 Aprovado com condições), `toconline-api-reference.md`
  (corrections verified in the spike), `integration-runbooks.md` (TOConline token expiry, AT
  failures), `admin-operator-playbooks.md`, `operator-tasks/toconline-setup.md`,
  `feature-flag-rollout-plan.md`, `decision-log.md` (accountant 2026-09-15 Aprovado com
  condições, D-03, D-09).

## Local references

- `packages/accounting/src/**`, `.cursor/rules/toconline-integration.mdc`,
  `.claude/skills/toconline-integration/SKILL.md`, `docs/eleva-v3/toconline-api-reference.md`,
  `docs/eleva-v3/payments-payouts-spec.md` (Two-Tier Invoicing Model), ADR-013.
- `apps/api/src/app/accounting/**`, `apps/api/src/app/expert/profile/invoicing/route.ts` (singular
  `expert/` since the Phase 4B rename),
  `apps/expert/src/app/**` (onboarding steps).
- `packages/encryption` (Phase 3 API), `packages/flags/src/**`, `packages/workflows/src/**`,
  `infra/qstash/**`.
- MVP: none (invoicing was manual in the MVP).

## External docs

- TOConline API — official docs https://api-docs.toconline.pt are the SSOT; the local
  `toconline-api-reference.md` (historical hostnames `api33`/`app33`) is a starting point to be
  verified in PR 07.0, and the verified values go into env config, not code.
- Moloni API docs (official site).
- VIES SOAP/REST check (EU Commission docs).
- Vercel Flags `/vercel/flags`; QStash `/upstash/qstash-js`.
- SAF-T PT XML schema (Autoridade Tributária) for the export skeleton.

## Risks

- TOConline has no AT sandbox: TEST FT/NC stay **uncommunicated** (TOConline-only).
  Never `Comunicar série` on TEST. Do not finalize fictitious TOConline documents. Do not
  use ELEVA production series to simulate. Communicate and issue **ELEVA** only after legally
  required procedures (env guard `TOCONLINE_SERIES_PREFIX`). Staging must not send AT documents.
- Accountant 2026-09-15 is **Aprovado com condições**: D-09 historical classification is
  approved (regularization track still required). PR 07.1 automatic **production** issuance
  and intra-EU flows stay blocked on pending fiscal parameters. Tier 2 (07.2), OAuth, schema,
  and TEST-series-without-issuance can proceed.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (toconline-integration, api-first-agentic, audit-wiring,
   encryption, stripe-webhooks) and .claude/skills/toconline-integration/SKILL.md plus
   .cursor/skills/coderabbit-review/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/07-invoicing-toconline.md in full.
3. Read every file under "Local references" (toconline-api-reference.md end to end). Pull Vercel
   Flags, QStash docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory. For TOConline the
   official documentation (https://api-docs.toconline.pt) is the SOURCE OF TRUTH for hostnames,
   OAuth endpoints and payloads; the local toconline-api-reference.md is historical input used
   only to list what PR 07.0 must verify — never copy an endpoint from it into code.
4. Entry gate (checked after PR 07.0 merges): D-09 historical classification is
   accountant-approved with conditions (2026-09-15, Aprovado com condições). Founder
   2026-09-17 unblocks **07.1 engineering**. PR 07.1 automatic **production** issuance
   and activating intra-EU flows stay **BLOCKED** (ELEVA Comunicação + remaining
   Manolo confirmation of live tax codes/rates/legal mentions). Implement 07.1
   schema, IVA lookups (`GET /taxes`), fail-closed VIES, and closed-gate
   `issuePlatformFeeInvoice` orchestration. Stop before live v1 POST, finalize,
   and AT communication. Do not Comunicar TEST FT/NC, do not finalize fictitious
   TOConline docs, do not use ELEVA production series to simulate.
   `issueInvoice()` stays unconditionally closed.

Workflow (mandatory) — this is the outer loop; the "PHASE 7 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-07.1/tier1-platform-fee-invoices
- PR 07.0 spike is complete. PR 07.2 Tier 2 adapters are on main. Founder 2026-09-17
  unblocks 07.1 **engineering**. Implement remaining 07.1 slices in order: schema + RLS
  + OpenAPI stubs (no POST); tax matrix (GET /taxes, reverse charge ISE + exemption
  lookup, fail-closed VIES / unclassified extra-EU); issuePlatformFeeInvoice
  orchestration + webhook hook that still refuses v1 POST unconditionally; credit notes
  on commission reduction. Then STOP and report the production-issuance / AT Comunicação
  block. Never POST `/api/v1/commercial_sales_documents`. Each PR:
  <= 30 files / 400 lines where possible; split above 60 / 800 and always before 100 reviewable files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
  or the review cap is reached (README section 4 rule 4: max 3 rounds, zero Critical/Major left,
  remaining Minor/Trivial listed in the PR body "Deferred findings" table with a reason each).
- Commit with Conventional Commits. Run: pnpm review:branch -> fix -> repeat until clean or
  the cap (max 2 rounds, same exit rule).
- git push -u origin HEAD && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green
  (after 2 App rounds escalate leftovers to the reviewer — README section 4 rule 6); request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.
- git checkout main && git pull --ff-only

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for every app's required locales (pt/en/es; apps/admin
pt/en only — decision-log staff-only exception), cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 7 TASK — Two-tier invoicing (ADR-013): Eleva -> expert platform-fee invoice on TOConline for
every paid booking, and expert -> member invoice through the expert's connected software.

PR 07.0 — spike (throwaway under packages/accounting/spikes/, evidence is the deliverable):
against the Eleva TOConline account using a TEST series only (env guard
TOCONLINE_SERIES_PREFIX=TEST). Prove and record in docs/eleva-v3/spikes/07-toconline.md: the
current OAuth flow and hostnames from https://api-docs.toconline.pt, customer upsert, service
upsert, series lookup, refresh-token behaviour, rate limits and error payloads. Do **not**
communicate TEST to AT and do **not** issue TEST sales documents (TOConline refuses
uncommunicated series; TEST must not become an official AT series). Invoice, PDF, AT
communication and credit note wait for ELEVA at go-live. Update toconline-api-reference.md
with what was verified; delete the spike code before PR 07.1.

PR 07.1 — Tier 1 (Eleva platform) — **engineering unblocked; DO NOT START production issuance**.
Founder 2026-09-17 allows schema, IVA lookups, fail-closed VIES, and closed-gate
orchestration. D-09 historical classification is Aprovado com condições; automatic
production issuance, v1 POST, finalize, and AT communication stay BLOCKED.
`issueInvoice()` is unconditionally closed. Do not Comunicar TEST, do not finalize
fictitious TOConline docs, do not use ELEVA production series to simulate.
1. packages/accounting restructure: src/core/{iva.ts (decision table + tests matching the
   accountant 2026-09-15 conditions — not the old automatic EU-without-VIES=consumer /
   extra-EU zero-rate table; tax codes/rates/legal mentions pending), vies.ts (VIES
   check at registration and before issuance with evidence retained; 24h cache + downtime
   procedure pending specific validation before activating intra-EU), types.ts, credentials.ts (encrypt/decrypt via
   @eleva/encryption encryptForOrg with orgId = Eleva staff org for Tier 1 or expert org for
   Tier 2)}, src/eleva-platform/toconline-client.ts (OAuth 2.0 Authorization Code — proven
   simplified flow: no PKCE, HTTP Basic client_id:secret, scope commercial;
   token refresh, base URL and OAuth URL from TOCONLINE_API_BASE_URL /
   TOCONLINE_OAUTH_BASE_URL in @eleva/env — values verified in PR 07.0 against
   https://api-docs.toconline.pt, never literals in code; headers per reference;
   methods upsertCustomer, upsertService, createSalesDocumentV1, finalize, getPdfUrl,
   sendToAT, emailDocument, createCreditNote), src/eleva-platform/platform-fee-invoices.ts
   (issuePlatformFeeInvoice(bookingPaymentId) — refuses bookings with paid_at before the
   cutover marker / platform_fee_invoices.status legacy|legacy_missing (D-09) —,
   issuePlatformFeeCreditNote on commission reduction or cancellation — not exclusively on
   technical refund success — amounts from computeSettlement.creditNoteAllocation when
   contractual conditions determine a proportional commission reduction),
   src/eleva-platform/clinic-saas-invoices.ts (issueClinicSaasInvoice(subscriptionId, periodStart,
   periodEnd) — implemented, wired in Phase 11). Env: TOCONLINE_CLIENT_ID, TOCONLINE_CLIENT_SECRET,
   TOCONLINE_OAUTH_BASE_URL, TOCONLINE_API_BASE_URL, TOCONLINE_OAUTH_REDIRECT, TOCONLINE_SERIES_PREFIX
   (staging may set TEST locally; never communicate TEST to AT; production ELEVA is communicated
   at go-live), ELEVA_PLATFORM_NIF, ELEVA_PLATFORM_ADDRESS_*.
2. packages/db: platform_fee_invoices (booking_payment_id PK, expert_org_id, series, number,
   toconline_document_id, amount_cents, iva_rate_bps, iva_regime (labels are implementation
   placeholders — do not treat eu_standard / non_eu_zero as a signed automatic table; see
   accountant 2026-09-15), status pending|issued|failed|dead_lettered|credited|legacy|
   legacy_missing (the retry policy in item 3 uses pending -> issued | failed -> dead_lettered;
   credited after a credit note; legacy / legacy_missing are terminal statuses written ONLY by
   the Phase 14 importer for MVP bookings paid before cutover (D-09) and never by the issuance
   workflow; manual_pending belongs to expert_invoices only), legacy_document_ref text nullable
   (D-09), pdf_url, at_status, issued_at,
   error, attempts), platform_fee_credit_notes, clinic_saas_invoices (subscription_id +
   period_start PK, ...), accounting_reconciliation_runs (month, stripe_fee_total_cents,
   invoiced_total_cents, mismatch_bps, status, details jsonb, created_at). RLS; audit unions.
3. Trigger: in the payment_intent.succeeded webhook handler (@eleva/billing), after the ledger row
   is written, insert the platform_fee_invoices row as pending in the same transaction and enqueue
   issuePlatformFeeInvoice via @eleva/workflows (idempotent on booking_payment_id; a replayed
   event must not create a second invoice). Completion SLA: issued within 60 s. Retry policy
   (single SSOT, same wording as the acceptance criteria): fast stage = QStash exponential
   backoff, max 5 attempts, then status failed + alert (Sentry + ops email); slow stage =
   invoicing-retry sweep (item 4) re-processes failed rows every 30 min, max 10 further attempts,
   then status dead_lettered + workflow_dead_letters row + admin flag. platform_fee_invoices
   status union: pending|issued|failed|dead_lettered|credited|legacy|legacy_missing (item 2; the
   two legacy values are Phase 14 importer-only).
   Domain events (transactional outbox): the domain_events_outbox table, emitDomainEvent(tx,
   event) in packages/workflows/src/domain-events.ts and POST /workflows/domain-events-publisher
   (FOR UPDATE SKIP LOCKED, subscriber registry, dead-letter after 10) already exist from Phase 4
   — do NOT recreate them; extend the typed event union and call emitDomainEvent inside the same
   Drizzle transaction as the invoice status change — never emit from after() alone. New event
   types invoice.issued | invoice.failed |
   invoice.credited with payload { invoiceKind, invoiceId, bookingPaymentId|bookingId, expertOrgId,
   number, pdfUrl?, error? } and idempotency_key `invoice:${kind}:${id}:${status}`; register a
   structured-log subscriber now (Phase 8 registers sendNotification, idempotent on that key).
   Tests: the same webhook replayed twice -> one invoice row, one outbox row; a simulated crash
   after commit and before publish -> exactly one delivered event on the next publisher run.
   Transfer gate: the Phase 6 payout engine (packages/billing payouts) must check
   platform_fee_invoices.status = issued for the booking before creating any Stripe transfer and
   skip (not fail) the payout run for that booking until it is — add that check and its test in
   this phase. On refund or transfer
   reversal with an issued invoice -> issuePlatformFeeCreditNote (full or proportional). Flag gate ff.toconline_invoicing_enabled (default off;
   on for staging).
4. Workflows: packages/workflows/src/invoicing/{invoicing-retry.ts (every 30 min; slow stage of
   the retry policy in item 3: re-processes failed rows with backoff, max 10 further attempts,
   then dead_lettered + workflow_dead_letters + admin flag; test the 5 + 10 boundary), stripe-toconline-
   reconciliation.ts (monthly 1st 05:00 Europe/Lisbon; sum booking_payments.application_fee_cents
   per expert net of refunds — there is NO Stripe application-fee object in the separate charges
   and transfers flow — vs platform_fee_invoices minus credit notes; cross-check gross charge
   totals against Stripe balance transactions only as a sanity check; write run row; mismatch >
   0.1% -> BetterStack alert through @eleva/observability)}; routes under apps/api/src/app/workflows/*; infra/qstash/
   setup-invoicing.ts + root script + setup:all.
5. API (staff capability admin_accounting:read): GET /invoicing/platform-fee?month=,
   GET /accounting/reconciliation, POST /invoicing/platform-fee/[bookingPaymentId]/retry.
   OpenAPI + client.
6. Tests: IVA decision table matching accountant 2026-09-15 conditions (not EU-without-VIES
   auto-consumer / extra-EU indiscriminate zero-rate), VIES check + evidence retention (24h
   cache + downtime procedure pending validation before intra-EU activation), client with
   recorded fixtures (msw), idempotent issuance,
   credit note (commission reduction; refund without commission reduction does not by itself
   originate an Eleva credit note), reconciliation math. Docs: operator-tasks/toconline-setup.md (series creation
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
   (flag ff.expert_invoicing_apps_enabled + ff.invoicing.<provider>); the TOConline adapter
   MUST refuse POST /api/v1/commercial_sales_documents (v1 auto-finalizes). Persist
   document_series_id after OAuth; refresh tokens; record pending/failed with
   toconline_v1_auto_finalize_blocked. Do not issue TEST or ELEVA FTs.
10. API: POST /accounting/connect/[provider] (starts OAuth, returns URL), GET
    /accounting/callback (extend existing for provider + state), GET /accounting/status,
    POST /accounting/disconnect, POST /invoicing/expert/[bookingId]/retry, POST /invoicing/expert/
    [bookingId]/mark-manual, GET /invoicing/exports/saft?month= (CSV + XML zip via private Blob).
11. apps/expert: onboarding step "Invoicing" appended to the Phase 4B onboarding-steps.ts registry (Auto: connect TOConline or Moloni; Manual:
    acknowledgment checkbox with legal text pt/en/es) required before Become-Partner completes
    (update expert/profile/steps/[step]/complete — singular since Phase 4B); session detail shows invoice status with
    Retry and "Mark as issued manually"; /[orgSlug]/finance/invoices lists expert_invoices with
    monthly export button.
12. Tests: adapter dispatch, OAuth flow (mocked), idempotency per booking, manual export shape.
    Docs: payments-payouts-spec.md Tier 2 section, admin-operator-playbooks.md (verify connection
    in Become-Partner review), decision-log.md.

Acceptance (paste evidence): do **not** treat staging TEST issuance of FT/NC as an acceptance
path (accountant: no fictitious fiscal documents; no TEST Comunicação à AT; no ELEVA simulation).
07.2 evidence = OAuth + TEST lookups + closed issuance gate + token refresh; Moloni mocked;
manual mode export. Become-Partner blocked without invoicing choice. Boundary grep for
hardcoded api33.toconline.pt in application source empty (hosts are env). IVA tests match
accountant 2026-09-15 conditions, not a locked 23/13/6 table. D-09/D-03 are in
docs/eleva-v3/decision-log.md (Manolo (MB) 2026-09-15, Aprovado com condições).

Report: migrations, endpoints, schedules, flags, tests, CodeRabbit CLI counts, PR URLs, and the
operator tasks still pending (series, credentials, remaining fiscal-parameter confirmation before
07.1 production issuance).
```
