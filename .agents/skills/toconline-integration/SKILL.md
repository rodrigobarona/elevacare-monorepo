---
name: toconline-integration
description: >-
  TOConline ERP API integration for Portuguese fiscal invoicing — OAuth 2.0
  setup, sales document creation (FT/NC), customer management, VAT matrix
  (PT 23%, EU reverse charge M07, non-EU export M99), PDF download, AT
  communication, and adapter patterns for expert-side invoicing. Use when
  building, modifying, or reviewing any TOConline integration — including
  creating platform fee invoices, configuring document series, implementing
  the ExpertInvoicingAdapter interface, setting up OAuth tokens, handling
  VAT rules, or working in packages/accounting.
---

TOConline API base: `https://api33.toconline.pt`. OAuth: `https://app33.toconline.pt/oauth`. Auth flow: Authorization Code + PKCE (S256), scope `commercial`. Eleva document series prefix: `ELEVA`.

## Integration routing

| Building...                                        | Package location                                | Details                         |
| -------------------------------------------------- | ----------------------------------------------- | ------------------------------- |
| Platform fee invoice (Tier 1)                      | `packages/accounting/src/eleva-platform/`       | <references/sales-invoicing.md> |
| Clinic SaaS invoice (Tier 1)                       | `packages/accounting/src/eleva-platform/`       | <references/sales-invoicing.md> |
| Credit note / refund                               | `packages/accounting/src/eleva-platform/`       | <references/sales-invoicing.md> |
| VAT / IVA rules configuration                      | `packages/accounting/src/core/`                 | <references/sales-invoicing.md> |
| TOConline OAuth setup and token management         | `packages/accounting/src/eleva-platform/`       | <references/auth-and-setup.md>  |
| New expert invoicing adapter (Tier 2)              | `packages/accounting/src/expert-apps/adapters/` | <references/api-endpoints.md>   |
| Customer upsert (search by NIF, create if missing) | `packages/accounting/src/eleva-platform/`       | <references/api-endpoints.md>   |
| Invoice PDF download                               | `packages/accounting/src/eleva-platform/`       | <references/api-endpoints.md>   |
| Send invoice by email                              | `packages/accounting/src/eleva-platform/`       | <references/api-endpoints.md>   |
| Stripe webhook -> invoice trigger                  | `packages/billing/` -> `packages/accounting/`   | <references/sales-invoicing.md> |
| Reconciliation (Stripe fees vs TOConline totals)   | `packages/accounting/src/core/`                 | <references/sales-invoicing.md> |
| Document series lookup                             | `packages/accounting/src/eleva-platform/`       | <references/auth-and-setup.md>  |
| AT communication (report to tax authority)         | `packages/accounting/src/eleva-platform/`       | <references/api-endpoints.md>   |

Read the relevant reference file before answering any integration question or writing code.

## Related packages

- `@eleva/billing` (`packages/billing/`) — Stripe Connect, webhooks, payouts
- `@eleva/db` (`packages/db/`) — Neon tables: `platform_fee_invoices`, `clinic_saas_invoices`, `expert_integration_credentials`
- `@eleva/encryption` (`packages/encryption/`) — WorkOS Vault for OAuth token storage
- `@eleva/flags` (`packages/flags/`) — `ff.toconline_invoicing_enabled`, `ff.expert_invoicing_apps_enabled`, `ff.invoicing.{provider}`
- `@eleva/workflows` (`packages/workflows/`) — `issuePlatformFeeInvoice`, `issueClinicSaasInvoice`, `issueExpertServiceInvoice`
- `@eleva/observability` (`packages/observability/`) — Sentry spans for TOConline API calls

## Key documentation

- [TOConline API Reference](docs/eleva-v3/toconline-api-reference.md)
- [ADR-013 — Accounting Integration](docs/eleva-v3/adrs/ADR-013-accounting-integration.md)
- [TOConline API docs (external)](https://api-docs.toconline.pt/llms.txt)
