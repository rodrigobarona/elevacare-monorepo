# Eleva.care v3 Compliance And Data Governance

Status: Living

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

## Vendor Governance

Every major vendor should be evaluated for:

- data residency
- DPA/contract posture
- security posture
- role in the data flow
- whether it handles sensitive Eleva data directly

Current planned vendor areas include:

- WorkOS
- Neon
- Stripe
- Daily
- Resend
- PostHog
- Sentry
- BetterStack
- Upstash
- Vercel AI Gateway and downstream model providers

## Recommended Sensitive Data Boundaries

The team should explicitly define storage and access rules for:

- transcripts
- session notes
- session reports
- uploaded documents
- diary entries
- consent records

These should not all be treated identically.

## Operational Rules

- Do not place sensitive content in URLs.
- Do not include unnecessary sensitive content in notifications.
- Do not log sensitive content to generic logging or analytics tools.
- Minimize access in both UI and backend service layers.

## Open Questions

- final retention periods per artifact type
- final export scope for diary and transcript data
- exact vendor-by-vendor residency and DPA position
- final expert visibility defaults for tracked mobile data

## Related Docs

- [`identity-rbac-spec.md`](./identity-rbac-spec.md)
- [`ai-reporting-spec.md`](./ai-reporting-spec.md)
- [`mobile-integration-spec.md`](./mobile-integration-spec.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
