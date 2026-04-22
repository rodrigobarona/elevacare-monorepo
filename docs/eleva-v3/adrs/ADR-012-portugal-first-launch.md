# ADR-012: Portugal-First Launch

## Status

Accepted

## Date

2026-04-22

## Context

Eleva is launching in Portugal with the PT supply and demand side. Several PT-specific requirements are launch-blocking, not phase-2:

- ERS (Entidade Reguladora da Saúde) alignment — Eleva is a digital health platform, not a direct provider; documentation and audit-trail exports are required
- NIF collection for invoicing (required for both customer-side receipts and expert-side B2B invoices)
- Stripe Tax PT configuration with PT rules
- Certified invoicing via TOConline (AT-certified)
- MB WAY as the primary PT wallet (Multibanco vouchers excluded — ADR-005)
- Consent banner + GDPR + ERS-aligned privacy posture
- DSAR support with short completion target
- Vault crypto-shredding on org deletion, verified

## Decision

- v3 **launches Portugal-first** with locales `pt`, `en`, `es`.
- Launch requirements (M8 gate):
  - ERS PT documentation published at `apps/docs/compliance/portugal/`
  - NIF collection on expert onboarding, clinic onboarding, and patient checkout
  - Stripe Tax PT configured in both staging and production
  - TOConline OAuth operational; `ELEVA-FEE-{YYYY}` and `ELEVA-SAAS-{YYYY}` series created; pilot expert + pilot clinic green end-to-end
  - IVA matrix accountant-signed-off
  - MB WAY enabled via Stripe Dynamic Payment Methods
  - Multibanco vouchers explicitly excluded
  - Consent banner wired to GA4 (marketing) + PostHog (product) + Resend marketing consent
  - `dsarExport` Vercel Workflow operational with 10-minute completion target
  - `vaultCryptoShredder` Vercel Workflow operational; integration test passing
  - Daily, Neon, Resend, WorkOS, Sentry, BetterStack EU regions contractually confirmed
  - Tier 2 invoicing registry with ≥2 adapters (TOConline expert-side + Moloni) production-tested; Manual/SAF-T export operational
  - Become-Partner admin verification enforces invoicing choice

## Alternatives Considered

### Option A — Launch EU-wide simultaneously

- Pros: larger TAM
- Cons: per-country tax + invoicing + language complexity explodes; marketplace liquidity dilutes

### Option B — Launch PT + ES together

- Pros: second market from day one
- Cons: ES fiscal model (Holded/FacturaDirecta) is a Phase-2 Tier 2 scope; doubles legal prep

### Option C — PT-first (chosen)

- Pros: concentrates liquidity, validates fiscal + compliance pipeline, existing network of PT experts and practitioners
- Cons: ES and EU expansion requires another focused push (acceptable, sequenced)

## Consequences

- All Portugal-specific work (ERS docs, TOConline, MB WAY, NIF, PT Tax, PT invoice series) is in the M8 launch-readiness checklist
- ES expansion is a Phase-2 project: Holded / FacturaDirecta adapters (Tier 2), `es` locale already present, Stripe Tax ES + VIES flows ready
- Multibanco vouchers stay excluded unless a future ADR revisits
- Consent banner treats PT as the "strict" baseline; other markets inherit
