# ADR-013: Accounting Integration — Two-Tier Invoicing

## Status

Accepted

## Date

2026-04-22

## Context

Portugal requires every business transaction to be invoiced in certified invoicing software and reported to AT. Eleva's fee on every booking is such a transaction; the expert's service to the patient is another. These are two separate legal invoices with two different vendors and two different obligors.

The MVP does not model this. v3 must, or Eleva cannot operate compliantly in PT.

Eleva should not force experts onto a specific fiscal tool — PT experts commonly use Moloni, InvoiceXpress, TOConline, Vendus, or Primavera. But Eleva should offer automation to the experts who opt in, and expose clean data for those who invoice manually.

## Decision

**Two-tier invoicing model, crystal clear in every doc and expert UI.**

### Tier 1 — Eleva → Expert / Clinic (automated, Eleva's own fiscal software)

- **Provider**: TOConline (OCC-backed, AT-certified, OAuth, sandbox + production)
- **Two invoice variants**:
  - Per-booking solo-expert commission invoice — series `ELEVA-FEE-{YYYY}`, triggered by `issuePlatformFeeInvoice` Vercel Workflow step
  - Monthly clinic SaaS invoice — series `ELEVA-SAAS-{YYYY}`, triggered by `issueClinicSaasInvoice` on Stripe subscription period boundary
- **Idempotency**: Neon `platform_fee_invoices(booking_id PK, …)` and `clinic_saas_invoices(subscription_period PK, …)`
- **IVA/VAT matrix**:
  - PT (valid NIF) → 23% IVA
  - EU (valid VIES NIF) → reverse charge (0% IVA, note on invoice)
  - EU (no valid VIES NIF) → 23% IVA
  - Non-EU → zero-rated
- **Reconciliation**: monthly QStash cron aggregates Stripe application fees vs TOConline totals; mismatches surface to `/admin/accounting`
- **Feature flag**: `ff.toconline_invoicing_enabled` (staged rollout: staging → 1 pilot → all PT → default on for PT)
- **Vault**: OAuth tokens encrypted via WorkOS Vault

### Tier 2 — Expert → Patient (adapter registry, expert's own fiscal software)

- **Legal posture**: the expert is the vendor; Eleva never issues this invoice on Eleva's fiscal software. Eleva automates issuance on the **expert's** software when the expert connects it.
- **Architecture** — cal.com-inspired `app-store` pattern:
  - `packages/accounting/expert-apps/adapters/<slug>/` with manifest + OAuth/API-key install + `ExpertInvoicingAdapter` implementation
  - shared interface: `connect / issueInvoice / status / disconnect`
  - per-expert credentials in Neon `expert_integration_credentials` (vault-encrypted)
- **Seed adapters**:
  - **P1**: TOConline (expert-side), Moloni, Manual/SAF-T export
  - **P2**: InvoiceXpress, Vendus
  - **P3**: Primavera Cloud
  - **Phase-2 ES**: Holded, FacturaDirecta
- **Expert onboarding forces a choice**:
  - auto mode — connect a supported adapter
  - manual mode — acknowledge legal obligation; Eleva exposes booking + patient fiscal data + monthly SAF-T/CSV export
- **Admin verification**: Become-Partner review confirms working connection or explicit manual acknowledgment before expert activation
- **Per-booking trigger**: `issueExpertServiceInvoice` Vercel Workflow dispatches to the expert's selected adapter; idempotent per `booking_id + expert_id`
- **Retry queue**: `expertInvoiceRetry` DLQ with manual-issuance fallback surfaced in expert dashboard
- **Feature flags**: `ff.expert_invoicing_apps_enabled` global, `ff.invoicing.{provider}` per adapter

### Clinic → Expert third-leg invoice — out of scope

When `ff.three_party_revenue` is active, any clinic↔expert commission split is the **clinic's own bookkeeping**. Eleva exposes the data; clinics issue their clinic↔expert invoices on their own systems. Revisiting requires a new ADR.

## Alternatives Considered

### Option A — Force all experts onto TOConline

- Pros: simplest for Eleva
- Cons: commercial friction; experts already on Moloni/InvoiceXpress won't switch; some clinics have their own setups

### Option B — Don't automate expert→patient invoicing at all

- Pros: simplest
- Cons: Eleva loses a major value-add for PT experts; Manual + SAF-T-only is acceptable as a fallback but not as the only option

### Option C — Build one adapter and expand later

- Pros: ship faster
- Cons: coupled architecture, harder to add second adapter; seeding TOConline + Moloni + Manual at launch is not much more work because the interface is small

### Option D — Two-tier with adapter registry (chosen)

- Pros: matches PT market reality, clean legal model, cal.com app-store pattern proven, per-expert choice respected
- Cons: more surface area; requires CI discipline to keep adapters isolated

## Consequences

- `packages/accounting` exists with two clear subareas (`eleva-platform/` for Tier 1, `expert-apps/` for Tier 2)
- Every PT expert going through Become-Partner chooses an invoicing path before activation
- Admin UI shows invoicing status per expert; red flag if OAuth expires or manual acknowledgment is stale
- IVA matrix must be accountant-signed-off before Tier 1 code ships
- Reconciliation mismatches caught monthly, not quarterly
- Adding a new PT adapter (e.g., InvoiceXpress in P2) = one folder in `adapters/` + one flag
- Expert-side OAuth tokens stored in WorkOS Vault; revocation on disconnect is clean
