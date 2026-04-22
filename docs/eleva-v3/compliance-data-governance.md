# Eleva.care v3 Compliance And Data Governance

Status: Authoritative

## Purpose

This document defines the core compliance and data-governance posture for Eleva.care v3.

It should guide:

- privacy-by-design decisions
- consent and visibility rules
- retention and deletion behavior
- audit requirements
- vendor evaluation and data-boundary decisions

## Positioning

Eleva should remain positioned as a digital health platform that enables experts to deliver services.

This document does not replace legal advice, but it defines the engineering and product posture the team should build toward.

## Core Principles

- EU-first and privacy-aware by default.
- Sensitive data access must be explicit, auditable, and justified.
- Data sharing should be modeled, not implied.
- The platform should minimize unnecessary exposure of sensitive data.
- The team should prefer durable policy boundaries over ad hoc implementation shortcuts.

## Data Classification

At minimum, the system should classify data into:

### Public

Examples:

- marketing content
- public expert profile content
- docs/help content

### Internal operational

Examples:

- non-sensitive admin metadata
- delivery metadata
- system events

### Personal data

Examples:

- names
- email addresses
- account details
- billing contact information

### Sensitive customer/patient-adjacent data

Examples:

- session notes
- reports
- transcripts
- uploaded documents
- diary entries
- symptom logs

## Consent Model

Consent or lawful-basis rules must be explicit wherever the platform processes or shares sensitive customer/patient data.

The system should model:

- what the person consented to
- when they consented
- version/policy reference where needed
- whether consent was revoked or changed

## Visibility Rules

The system should explicitly model who can see what.

Examples:

- patient can see own data
- expert can see shared diary data only after permission exists
- operator can see operational metadata but not necessarily full sensitive content

Visibility should not be inferred loosely from role labels alone.

## Audit Requirements

The platform should audit at least:

- access to shared diary data
- access to transcripts
- report generation and publication
- permission changes
- payout approvals
- export/delete operations
- high-risk admin actions

Audit records should be durable and tamper-resistant at the application level.

## Retention And Deletion

The platform must define retention behavior for:

- transcripts
- reports
- uploaded documents
- diary entries
- audit logs
- operational logs

Deletion behavior must distinguish between:

- customer-facing deletion expectations
- regulatory/accounting retention needs
- immutable audit requirements

## Export And Portability

The platform should be ready to support:

- account-level export
- diary/tracking data export
- report/document export
- machine-readable portability where appropriate

## AI Data Governance

AI pipelines must explicitly define:

- which inputs are eligible
- what consent/visibility is required
- whether outputs are drafts or final artifacts
- how long AI artifacts are retained

Sensitive data should not be casually copied into generalized logs or debugging systems.

## Tenancy Isolation (Neon RLS)

**Locked decision**: Neon Postgres with Row-Level Security on every tenant-scoped table, enforced via the `withOrgContext()` helper in `packages/db`.

Structure:

- **two Neon projects**: `eleva_v3_main` (application data) and `eleva_v3_audit` (immutable audit stream)
- every tenant-scoped table has an `org_id` column with an RLS policy keyed on `current_setting('eleva.org_id')`
- `withOrgContext(orgId, fn)` runs `SET LOCAL eleva.org_id = ...` inside a transaction before executing `fn`
- application code never passes raw `orgId` to queries — it passes through `withOrgContext` and the query uses RLS-filtered views

CI guard:

- integration test inserts as org A, selects as org B → must return zero rows
- lint rule blocks raw `db.select(...)` calls outside `withOrgContext`

## Vendor Governance

Every major vendor is evaluated for:

- data residency
- DPA/contract posture
- security posture
- role in the data flow
- whether it handles sensitive Eleva data directly

### EU residency per vendor (locked)

| Vendor | Region | Role | Handles PHI-adjacent? |
|---|---|---|---|
| WorkOS | EU | auth, orgs, Vault | yes (OAuth tokens, encrypted refs) |
| Neon | EU | database | yes (all domain data + audit stream) |
| Stripe | EU entity (Ireland) | payments, payouts, subscriptions | no (payment metadata only) |
| Daily.co | EU | video + transcript source | yes (transcript metadata, we store content ourselves) |
| Resend | EU | transactional email + Automations | no (PHI-free payloads enforced by Lane 2 schema) |
| Twilio | EU subaccount | SMS | no (minimum-necessary bodies) |
| PostHog | EU / privacy-first | product analytics (apps/app) | no |
| GA4 | — | marketing analytics (apps/web) | no (opt-in only) |
| Sentry | EU | error tracking | scrubbed; never full PHI |
| BetterStack | EU | logs + uptime | scrubbed; redaction policy enforced |
| Upstash | EU | Redis + QStash | no (ephemeral coordination) |
| Vercel AI Gateway | model-dependent | AI routing | yes (transcript summarization, AI reports; governed by ADR-009) |
| TOConline | PT (AT-certified) | invoicing (Tier 1 + Tier 2 adapter) | invoicing metadata only |
| Moloni / InvoiceXpress / Vendus / Primavera | PT | Tier 2 adapters | invoicing metadata only, per-expert opt-in |

## Recommended Sensitive Data Boundaries

The team should explicitly define storage and access rules for:

- transcripts
- session notes
- session reports
- uploaded documents
- diary entries
- consent records

These should not all be treated identically.

## Portugal-First Launch Requirements

v3 launches Portugal-first. The following are launch requirements, not phase-2:

- **ERS Portugal** compliance: Eleva is positioned as a digital health platform (not direct provider); required documentation published at `apps/docs/compliance/portugal/`; audit-trail exports on demand.
- **Stripe Tax PT** + **NIF collection** on checkout (customer) and expert/clinic profile (invoicing).
- **TOConline Tier 1 invoicing** operational (series `ELEVA-FEE-{YYYY}` for solo commission, series `ELEVA-SAAS-{YYYY}` for clinic SaaS) with pilot expert/clinic green end-to-end.
- **MB WAY** enabled at checkout via Stripe Dynamic Payment Methods. Multibanco reference vouchers excluded.
- **Consent banner** wired to GA4 (marketing) + PostHog (product) + Resend marketing consent.
- **DSAR workflow** verified (`dsarExport` Vercel Workflow: export all user data → Vercel Blob → time-limited signed URL → admin-notified; 10-minute target for completion).
- **Vault crypto-shredding** on org deletion, verified by integration test.
- **Daily/Neon/Resend/WorkOS EU regions** confirmed contractually before production traffic.

## Retention And Deletion (locked defaults)

| Artifact | Retention | Deletion mechanism |
|---|---|---|
| Session notes | 10 years (ERS-aligned) | soft-delete + 30-day scrubber + Vault crypto-shred on org deletion |
| Reports (published) | 10 years | same |
| Reports (AI drafts not approved) | 90 days | auto-purge via `softDeleteScrubber` workflow |
| Transcripts | 2 years from session | auto-purge |
| Uploaded documents | 10 years | soft-delete + Vault crypto-shred on org deletion |
| Diary entries | user-controlled; default 5 years | user-driven export + delete; DSAR |
| Audit logs | 10 years, append-only | no user-facing deletion; immutable project |
| Operational logs (Sentry, BetterStack) | 90 days | vendor-side retention policy |

All retention periods subject to accountant + legal review before GA; current values are defaults, not final.

## Operational Rules

- Do not place sensitive content in URLs.
- Do not include unnecessary sensitive content in notifications (Lane 1 uses secure signed links; Lane 2 is PHI-free by schema).
- Do not log sensitive content to generic logging or analytics tools.
- Minimize access in both UI and backend service layers; enforce via Neon RLS + WorkOS RBAC + app permission gates.
- Correlation IDs propagate through audit rows for every mutating action.

## Open Questions

- final retention periods per artifact type (legal review pending)
- final export scope for diary and transcript data
- final expert visibility defaults for tracked mobile data

## Related Docs

- [`identity-rbac-spec.md`](./identity-rbac-spec.md)
- [`ai-reporting-spec.md`](./ai-reporting-spec.md)
- [`mobile-integration-spec.md`](./mobile-integration-spec.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
