# ADR-021: RBAC single source of truth in code

## Status

Accepted

## Date

2026-09-07

## Context

Eleva today has two out-of-band WorkOS configs (`infra/workos/rbac-config.json` for app
capabilities, `widgets-config.json` for Widget token scopes) plus a TypeScript mirror in
`packages/auth/src/capabilities.ts`. Product labels are derived from
`(org_type, workos_role)`. Scripts apply JSON to WorkOS; drift between JSON, the Dashboard
and the TypeScript mirror is a recurring incident class.

Better Auth's `organization` plugin takes a `createAccessControl` instance and a roles map
in the same process that enforces it. Widgets go away in Phase 3, so the second JSON file
has no successor.

Constraints: keep the product-label derivation `(organization.type, member.role)` so
existing UX (member / solo expert / clinic expert / clinic admin / staff) does not change;
staff roles are a different axis (`admin` plugin) and must never be `owner` of a customer
org; capability bundles in `capabilities.ts` must derive from `permissions.ts`, not the
other way around.

## Decision

1. **SSOT.** `packages/auth/src/permissions.ts` defines `createAccessControl` statements
   (resources: `org`, `members`, `billing`, `bookings`, `schedule`, `records`, `reports`,
   `invoicing`, `admin.*`) and roles built with `ac.newRole({...})`. The Better Auth
   `organization` plugin receives `{ ac, roles: { owner, admin, member } }`. The `admin`
   plugin receives staff roles `user | staff_support | staff_finance | platform_admin`.
2. **Organization roles.** `owner` / `admin` / `member` are seniority inside one org, not
   product labels. `organization.type` is
   `personal | expert | team | academy | staff`.
3. **Product labels.** Customer labels derive from `(organization.type, member.role)`.
   Staff is a **separate resolver branch** that reads the Better Auth `admin` plugin
   role, not `member.role`:

   | Product label   | Input                                                                                                                         |
   | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
   | Eleva staff     | `admin` plugin role in `staff_support \| staff_finance \| platform_admin` on `admin.eleva.care`, or active org `type = staff` |
   | Member          | active org `type = personal`, role `owner`                                                                                    |
   | Expert (solo)   | active org `type = expert`, role `owner`                                                                                      |
   | Expert (clinic) | active org `type = team`, role `member`                                                                                       |
   | Clinic admin    | active org `type = team`, role `owner` or `admin`                                                                             |
   | Academy admin   | active org `type = academy`, role `owner` or `admin`                                                                          |

   Precedence: if the request host is `admin.eleva.care` (or the active org is
   `type = staff`), the staff branch wins even when the same human also has
   customer memberships. `organization.setActive` selects the customer context
   on product hosts. Staff never become `owner` of a customer org.

4. **Capability bundles.** `capabilities.ts` is a derived view of `permissions.ts` for
   callers that want named bundles (`member_capabilities`, `expert_capabilities`, …).
   Adding a permission is: statement + role grant + bundle update + test. No JSON, no
   Dashboard click.
5. **Enforcement.** Route handlers call `requireApiAuth` then a capability check. Server
   Actions authenticate inside the action. RLS (ADR-003) is the data-plane backstop and is
   not a substitute for the capability check.
6. **Retirement.** `infra/workos/*.json`, `widget-scopes.ts`, `workos:rbac:generate` and
   `workos:widgets:generate` are deleted in Phase 3.

## Alternatives Considered

### Keep WorkOS RBAC JSON + generate scripts

- Pros: already applied in staging/prod.
- Cons: WorkOS is leaving; two files; Dashboard drift; Widgets scopes mixed with app
  capabilities.

### Casbin / Oso / custom policy language

- Pros: richer policy.
- Cons: another runtime and another mental model. Better Auth access control is enough
  for the launch catalog; revisit if clinic delegation needs ABAC.

## Consequences

- Positive: permissions version with the code that enforces them; one file to review in a
  PR; product labels stay stable.
- Tradeoff: no live Dashboard to tweak a role without a deploy. That is intended.
- Supersedes in part: ADR-015 (the "one WorkOS Application / RBAC JSON" section). The
  2026-04-22 RBAC backbone decision keeps the seniority model and label derivation.

## Related

- [`identity-rbac-spec.md`](../identity-rbac-spec.md)
- [ADR-017](ADR-017-better-auth-identity.md)
- Better Auth organization + admin plugins (`createAccessControl`)
