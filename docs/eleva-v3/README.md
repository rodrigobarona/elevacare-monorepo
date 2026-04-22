# Eleva.care v3 Handbook

This folder is the working documentation set for the Eleva.care v3 rebuild.

It should be treated as the team-facing source of truth for:

- product-to-engineering translation
- architecture and platform decisions
- monorepo structure
- domain modeling
- implementation sequencing
- compliance and data-governance constraints
- mobile and multi-surface strategy

This handbook is based on the master planning work captured in the Eleva v3 project plan and on the legacy product, blueprint, and vendor research already reviewed during planning.

## How To Use This Handbook

Read these documents in order when onboarding a developer, designer, PM, or agent to the project:

1. [`master-architecture.md`](./master-architecture.md)
2. [`monorepo-structure.md`](./monorepo-structure.md)
3. [`domain-model.md`](./domain-model.md)
4. [`identity-rbac-spec.md`](./identity-rbac-spec.md)
5. [`compliance-data-governance.md`](./compliance-data-governance.md)
6. [`scheduling-booking-spec.md`](./scheduling-booking-spec.md)
7. [`payments-payouts-spec.md`](./payments-payouts-spec.md)
8. [`notifications-spec.md`](./notifications-spec.md)
9. [`crm-spec.md`](./crm-spec.md)
10. [`ai-reporting-spec.md`](./ai-reporting-spec.md)
11. [`content-seo-spec.md`](./content-seo-spec.md)
12. [`mobile-integration-spec.md`](./mobile-integration-spec.md)
13. [`ops-observability-spec.md`](./ops-observability-spec.md)
14. [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
15. [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md)
16. [`organization-and-clinic-model.md`](./organization-and-clinic-model.md)
17. [`academy-strategy-spec.md`](./academy-strategy-spec.md)
18. [`data-retention-export-matrix.md`](./data-retention-export-matrix.md)
19. [`api-contract-spec.md`](./api-contract-spec.md)
20. [`design-system-spec.md`](./design-system-spec.md)
21. [`search-and-discovery-spec.md`](./search-and-discovery-spec.md)
22. [`calendar-integration-spec.md`](./calendar-integration-spec.md)
23. [`security-hardening-checklist.md`](./security-hardening-checklist.md)
24. [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
25. [`admin-operator-playbooks.md`](./admin-operator-playbooks.md)
26. [`integration-runbooks.md`](./integration-runbooks.md)
27. [`schema-and-migration-rules.md`](./schema-and-migration-rules.md)
28. [`testing-strategy.md`](./testing-strategy.md)
29. [`adrs/README.md`](./adrs/README.md)

**Brand, marketing, and design** should also use [`brand-book/README.md`](./brand-book/README.md) (and its appendices) so voice, visual identity, and partner boundaries stay consistent with the Eleva.care product reference.

## Document Status

The docs in this folder use these meanings:

- `Authoritative`: approved direction the team should implement against
- `Draft`: working proposal that still needs a decision
- `Living`: approved, but expected to evolve as implementation reveals new constraints

Unless a document says otherwise, assume it is `Living` and should be updated when major decisions change.

## Current Canon

### Authoritative starting decisions

- Eleva v3 is an EU-first digital health platform with strong compliance and privacy boundaries.
- The first authenticated web product should be one app with strong RBAC and route-group separation.
- The public marketing/discovery surface and the authenticated product surface should be separate apps.
- The monorepo should be built with `pnpm` workspaces and Turborepo.
- `Eleva Diary` should join the same monorepo, but only after shared backend and contract layers are stable.

### Inputs this handbook is grounded in

- `/_context/blueprints/elevacare-mvp/*`
- `/_context/blueprints/multi-zone-monorepo.md`
- `/_context/clone-repo/next-forge/README.md`
- `/_context/clone-repo/eleva-care-app/*`
- `/_context/clone-repo/cal.diy/*`

## Handbook Structure

### Core architecture

- [`master-architecture.md`](./master-architecture.md): the high-level system view, major decisions, workstreams, and phased roadmap
- [`monorepo-structure.md`](./monorepo-structure.md): apps, packages, ownership boundaries, and evolution path
- [`domain-model.md`](./domain-model.md): the canonical product/data model for Eleva v3
- [`identity-rbac-spec.md`](./identity-rbac-spec.md): identity, organizations, memberships, and capability-based authorization
- [`api-contract-spec.md`](./api-contract-spec.md): API boundary model, DTOs, error contracts, and client/server contract rules

### Core product systems

- [`scheduling-booking-spec.md`](./scheduling-booking-spec.md): booking, availability, calendars, sessions, and reminders
- [`calendar-integration-spec.md`](./calendar-integration-spec.md): provider connections, busy-time vs destination calendars, and sync rules
- [`payments-payouts-spec.md`](./payments-payouts-spec.md): marketplace billing, subscriptions, packs, payouts, and financial states
- [`notifications-spec.md`](./notifications-spec.md): email, SMS, in-app, reminders, and delivery model
- [`crm-spec.md`](./crm-spec.md): expert-facing customer relationship model, follow-up workflows, and segmentation
- [`ai-reporting-spec.md`](./ai-reporting-spec.md): transcripts, AI-assisted drafts, review flows, and reporting lifecycle
- [`search-and-discovery-spec.md`](./search-and-discovery-spec.md): marketplace discovery, filters, ranking, and public profile/search direction
- [`mobile-integration-spec.md`](./mobile-integration-spec.md): Expo app placement, sync/share rules, and patient-companion strategy

### Governance and platform quality

- [`compliance-data-governance.md`](./compliance-data-governance.md): data classification, consent, audit, retention, and vendor governance posture
- [`content-seo-spec.md`](./content-seo-spec.md): public content architecture, docs strategy, marketplace SEO, and metadata direction
- [`ops-observability-spec.md`](./ops-observability-spec.md): logging, monitoring, workflows, health signals, and incident readiness
- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md): current stack choices, vendor boundaries, and open validation items
- [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md): async job model, idempotency, retries, and durable workflow direction
- [`data-retention-export-matrix.md`](./data-retention-export-matrix.md): practical retention/export handling by data class
- [`security-hardening-checklist.md`](./security-hardening-checklist.md): practical hardening checks for identity, APIs, data, AI, payments, and launch readiness

### Delivery and operations

- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md): final cross-functional launch checklist
- [`admin-operator-playbooks.md`](./admin-operator-playbooks.md): internal staff playbooks for approvals, support, and sensitive operations
- [`integration-runbooks.md`](./integration-runbooks.md): provider failure handling and investigation paths
- [`schema-and-migration-rules.md`](./schema-and-migration-rules.md): schema ownership, migration discipline, and rollout safety rules
- [`testing-strategy.md`](./testing-strategy.md): test layering, critical-flow coverage, and validation priorities

### Decision records

- [`adrs/README.md`](./adrs/README.md): ADR index and writing guidance

### Brand

- [`brand-book/README.md`](./brand-book/README.md): Eleva.care brand handbook (voice, visual system, application)
- [`brand-book/assets/`](./brand-book/assets/): packaged logos, marks, social, favicons, imagery, palette JSON — copied from the MVP reference
- [`brand-book/previews/`](./brand-book/previews/): quick visual review boards (logos, color, imagery, app reference)
- [`brand-book/messaging-framework.md`](./brand-book/messaging-framework.md): message map and audience-specific guidance
- [`brand-book/art-direction.md`](./brand-book/art-direction.md): art direction and photography standards
- [`brand-book/GAP-ANALYSIS.md`](./brand-book/GAP-ANALYSIS.md): gap analysis for the first documentation-only pass vs recovery
- [`brand-book/assets-inventory.md`](./brand-book/assets-inventory.md): full asset lineage (pack + MVP source paths)
- [`brand-book/usage-examples.md`](./brand-book/usage-examples.md): patterns for web, product, email, and partners

### Experience system

- [`design-system-spec.md`](./design-system-spec.md): tokens, shared components, accessibility expectations, and `packages/ui` scope

### Growth and multi-tenant evolution

- [`organization-and-clinic-model.md`](./organization-and-clinic-model.md): how solo experts, clinics, and orgs fit into one tenant model
- [`academy-strategy-spec.md`](./academy-strategy-spec.md): future Academy direction without premature app splitting

## Required Follow-Up Docs

The team should add these next as implementation begins:

- `roadmap-and-milestones.md`
- `dependency-map.md`
- `feature-flag-rollout-plan.md`
- `release-versioning-strategy.md`
- `contribution-workflow.md`

## Rules For Maintaining This Folder

- Do not silently change a foundational decision in code only.
- When a major decision changes, update the relevant spec and add or supersede an ADR.
- Keep phase sequencing aligned with reality.
- Prefer explicit tradeoffs over vague statements.
- Link related docs to each other so the team can navigate the system quickly.
