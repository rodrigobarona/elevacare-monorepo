# Eleva.care v3 Identity And RBAC Spec

Status: Authoritative

## Purpose

This document defines the identity, tenancy, and authorization model for Eleva.care v3.

It should guide:

- WorkOS integration
- account lifecycle design
- organization and membership modeling
- RBAC implementation
- route and API authorization rules

## Identity Principles

- One human should map to one canonical Eleva user identity.
- Authorization should be capability-based, not hardcoded to page names.
- Organizations and memberships should be explicit.
- Guest access should be a transitional state, not a separate permanent identity system.
- RBAC must be enforced at multiple layers, not only in the UI.

## Identity Provider

**WorkOS** (EU region) is the locked identity, organization, RBAC, and Vault provider.

WorkOS should be responsible for:

- authentication
- social/enterprise identity where needed
- organization membership primitives
- role/permission claims where appropriate
- secure session handling

Eleva should remain responsible for:

- application-specific user profile data
- expert/patient/org lifecycle state
- domain-specific authorization checks
- data ownership and visibility rules

## Core Identity Model

### User

Represents one human identity.

Examples:

- patient
- expert
- organization admin
- Eleva operator

### Organization

Represents the main tenant boundary.

Examples:

- personal patient organization
- expert organization
- clinic organization
- team/company organization

### Membership

Represents the relationship between a user and an organization.

Contains:

- role assignment
- status
- timestamps
- scope where needed

## Role Strategy (Locked)

The platform uses a two-layer model:

- **WorkOS org-seniority roles** (`admin`, `member`) — the default pair WorkOS provisions on every org. These are **seniority inside an org**, not product labels.
- **Eleva permission/capability grants** (from `infra/workos/rbac-config.json`) — bundles of capabilities driving actual authorization decisions.

The **Eleva product label** (patient, expert, clinic admin, operator) is derived from the tuple `(org_type, workos_role)` plus capability bundles.

### Role catalog (what each user actually looks like)

|Eleva product label|WorkOS role|Org type|Provisioning|
|---|---|---|---|
|**Patient**|`admin`|Personal org (org-of-one, auto-provisioned on signup)|every user owns their own personal org; patient is `admin` of it|
|**Expert (solo)**|`admin`|Solo-expert org|dedicated solo org created on Become-Partner approval|
|**Expert (clinic member)**|`member`|Clinic org|clinic admin invites expert into the clinic org|
|**Clinic admin**|`admin`|Clinic org|clinic founder or elevated by existing clinic admin|
|**Eleva operator (staff)**|`admin`|Single internal `eleva-operator` org|Eleva staff accounts only; platform-wide capability bundle|

Notes:

- A single human can hold memberships across multiple orgs (e.g., same person = patient in their personal org + expert in a clinic org). Organization-switching UX makes the current context explicit.
- An expert is **either** solo (`admin` of a solo-expert org) **or** clinic member (`member` of a clinic org). Never both simultaneously — clean org switching rule.
- Eleva platform staff are never `admin` of a customer's org. They operate from the `eleva-operator` org with cross-org capability grants.

### Permission bundles (examples)

Assigned via `infra/workos/rbac-config.json` and loaded into JWT claims:

- `patient_capabilities`: `appointments:view_own`, `sessions:view_own`, `billing:view_own`, `diary:share`
- `expert_capabilities`: `events:manage`, `schedule:manage`, `bookings:manage_own`, `reports:manage_own`, `payouts:view_own`
- `clinic_admin_capabilities`: expert_capabilities + `members:manage`, `billing:manage_org`, `subscriptions:manage_org`
- `eleva_operator_capabilities`: `experts:approve`, `experts:reject`, `users:view_all`, `payments:view_all`, `payouts:approve`, `audit:view_all`, `workflows:retry`, `accounting:reconcile`

The capability bundle is what actually drives access — WorkOS `admin`/`member` is the backbone it hangs on.

## Recommended Enforcement Layers

Authorization should be enforced in at least four layers:

1. request/route layer
2. page/layout layer
3. server action / API handler layer
4. data access layer

The UI should never be the only protection.

## Account Lifecycles

### Patient/customer lifecycle

Suggested progression:

- guest booking
- invited or provisional account
- activated account
- full dashboard access

### Expert lifecycle

Suggested progression:

- application started
- profile incomplete
- compliance/review pending
- approved
- payout-ready
- published/marketplace-ready

### Organization lifecycle

Suggested progression:

- created
- configured
- billing ready
- member-enabled
- operational

## Guest User Model

The system should support first-time bookings without forcing a full account creation before conversion.

But the backend model should still preserve a clean path from:

- guest interaction
- to account activation
- to full patient/customer identity

Recommendation:

Treat guest status as an onboarding state linked to the canonical user path, not as an entirely separate actor type.

## Workspace Model

The first authenticated product is one web app with route groups.

That means route access should be shaped by:

- authentication state
- current organization context
- membership
- capabilities

The route groups may look like:

- `(patient)`
- `(expert)`
- `(org)`
- `(admin)`

But access decisions should be based on permissions and organization context, not only folder names.

## Organization Context

The application should explicitly resolve a current organization/workspace context.

This matters because a user may:

- belong to multiple organizations
- be an expert in one context and a patient in another
- switch between personal and organization workspaces

## Sensitive Data Access

Some permissions must be treated as higher-risk:

- access transcripts
- access shared diary data
- access uploaded documents
- approve payouts
- export data
- manage permissions or memberships

These actions should always be auditable.

## Admin Versus Operator

Do not assume every internal Eleva staff role should have the same power.

The model should distinguish between:

- internal support/operator permissions
- higher-trust administrative permissions

Examples of high-trust actions:

- payout approval
- audit export
- permission changes
- deletion-sensitive operations

## Future Academy Compatibility

The identity model must support future learning/academy roles without requiring a new identity system.

That means:

- reuse the same user
- reuse organization/membership concepts where possible
- add academy-specific permissions and profile extensions when needed

## Audit Requirements

The system must log:

- sign-in/sign-out relevant events where appropriate
- membership changes
- permission changes
- organization switches when security-sensitive
- access to sensitive user/customer data
- expert approval and status changes

## Tenancy Enforcement — Neon RLS

Identity + RBAC is one enforcement layer. The second, non-bypassable layer is **Neon Row-Level Security** (see ADR-003).

- `packages/db` exports `withOrgContext(orgId, fn)`.
- Every query runs inside `withOrgContext`, which opens a transaction, runs `SET LOCAL eleva.org_id = ...`, then executes `fn`.
- Every tenant-scoped table has an RLS policy keyed on `current_setting('eleva.org_id')`.
- Two Neon projects: `eleva_v3_main` (application) + `eleva_v3_audit` (immutable audit stream).
- Integration test: insert as org A, select as org B → zero rows.

## Vault Usage (WorkOS Vault)

`packages/encryption` wraps WorkOS Vault. Used for:

- Google/Microsoft OAuth tokens (for `packages/calendar`)
- TOConline OAuth tokens (Tier 1 invoicing — `packages/accounting/eleva-platform`)
- Expert integration credentials for Tier 2 invoicing (`packages/accounting/expert-apps`)
- Encrypted-at-rest references for transcripts, reports, session notes, uploaded documents

CI rule: no `process.env.ENCRYPTION_KEY`, no `crypto.createCipheriv('aes-256-gcm', …)` outside `packages/encryption`.

## Guest Activation Flow

- Patient books for the first time → Eleva creates a "guest user" identity in WorkOS tied to the booking email
- Activation email sent post-booking; patient sets password / connects social
- Once activated, all historical bookings attach to the activated account (same email match)
- Guest accounts can be reactivated if the patient returns and confirms email
- Audit rows capture guest creation + activation events

## Closed Decisions

- WorkOS is the identity provider (locked)
- **Role backbone = WorkOS defaults `admin` / `member`**; Eleva product labels derived from `(org_type, role)` + capability bundles (see Role Catalog above)
- Organization-per-user default for solo experts and patients (matches MVP blueprint)
- Eleva operators live in a single internal `eleva-operator` org with cross-org capability grants
- Neon RLS is the non-bypassable tenancy layer (ADR-003)
- Calendar OAuth is Eleva-owned (ADR-004) — not WorkOS Pipes
- WorkOS Pipes is reserved for identity-side integrations (SCIM provisioning, directory sync, SSO federation) — not booking-critical data planes like calendar sync

## Open Questions

- final role catalog vs capability catalog (generated from `infra/workos/rbac-config.json`)
- exact organization switching UX when a user has multiple memberships

## Related Docs

- [`master-architecture.md`](./master-architecture.md)
- [`domain-model.md`](./domain-model.md)
- [`compliance-data-governance.md`](./compliance-data-governance.md)
- [`organization-and-clinic-model.md`](./organization-and-clinic-model.md)
- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`adrs/README.md`](./adrs/README.md) (ADR-003 Tenancy & RLS)
