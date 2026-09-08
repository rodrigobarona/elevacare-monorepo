# ADR-017: Self-hosted Better Auth as the identity, session and organization layer

## Status

Accepted

## Date

2026-09-07

## Context

Eleva.care v3 was designed on WorkOS (AuthKit sessions, Organizations, RBAC, Vault, Pipes,
Widgets). The MVP runs on it today. The decision log entry
[2026-09-07: Execution-plan amendment](../decision-log.md) and the execution plan
([`execution-plan/README.md`](../execution-plan/README.md), Phases 2 and 3) lock the replacement;
this ADR records the architecture so the handbook, `AGENTS.md`, rules and code all describe one
target.

Why change:

- **Cost and control.** WorkOS pricing scales with organizations and MAU; Eleva creates one
  organization per human (personal Space) plus expert/clinic orgs, so the unit economics are wrong
  for a marketplace. Better Auth is MIT-licensed and runs inside `apps/api`.
- **Data residency.** Identity data (e-mail, names, sessions, OAuth tokens) stays in the Neon EU
  project that already holds the domain data and is covered by the same DPA (ADR-003,
  [`compliance-data-governance.md`](../compliance-data-governance.md)). One sub-processor fewer.
- **Product fit.** Personal Spaces, expert/team/academy org types, `(org_type, role)` product
  labels, guest activation, API keys for agents and passkeys are first-class in Better Auth's
  `organization`, `admin`, `apiKey`, `passkey`, `magicLink` and `twoFactor` plugins; on WorkOS the
  same needs required Widgets, Pipes and a sync job (`/workos/sync`) to mirror state.
- **RBAC in code.** Permissions become TypeScript (`createAccessControl`), versioned with the
  code that enforces them (ADR-021) instead of `infra/workos/rbac-config.json` applied by a
  script.
- **Encryption.** WorkOS Vault goes away; `@eleva/encryption` (ADR-020) already had to exist for
  PHI, so one envelope-encryption package covers everything.

Constraints: cross-subdomain sessions across `eleva.care`, `admin.eleva.care`, `api.eleva.care`
(ADR-014/015); agent-first API (Bearer/API-key auth, OpenAPI); MVP users must be migrated
without password export (ADR-019); Phase 2 proves the vendor behaviour in a spike PR
(`phase-02.0/spike-better-auth`) before the foundation PR opens.

## Decision

1. **One auth server, in `apps/api`.** `packages/auth/src/server.ts` exports `auth = betterAuth({...})`;
   `apps/api/src/app/auth/[...all]/route.ts` mounts it with `basePath: "/auth"` (the API has no
   `/api` prefix — ADR-014). No frontend app instantiates the server.
2. **Storage.** Drizzle adapter (`provider: "pg"`, `schema` = the tables in
   `packages/db/src/schema/auth/*`, PostgreSQL schema name `auth`) on the main Neon project. The
   Better Auth CLI generates the tables; hand edits are limited to indexes, RLS class headers and
   `additionalFields`. `secondaryStorage` = Upstash Redis (`KV_REST_API_URL`/`KV_REST_API_TOKEN`)
   for session cache, verification records and rate-limit counters.
3. **Plugins (server):** `organization` (custom access control from ADR-021 with roles
   `owner|admin|member`; `schema.organization.additionalFields.type` in
   `personal|expert|team|academy|staff`; `organizationHooks` for provisioning, audit and seat sync),
   `admin` (roles `user|staff_support|staff_finance|platform_admin`), `twoFactor`, `passkey`
   (`@better-auth/passkey`), `magicLink`, `bearer`, `jwt`, `apiKey` (`@better-auth/api-key`),
   `openAPI`, `nextCookies`. Every mail-sending callback routes through
   `packages/notifications/src/auth-mailer.ts` (Resend via `@eleva/email`) so idempotency,
   suppression and delivery records are uniform (Phase 8).
4. **Session and cookies.** `advanced.crossSubDomainCookies = { enabled: true, domain: ".eleva.care" }`;
   `__Secure-` prefixed, `HttpOnly`, `SameSite=Lax`; `session.cookieCache` enabled (5 min);
   `trustedOrigins` is the explicit environment list (never a wildcard); preview deployments call
   the staging API and never mint `.eleva.care` cookies. The staff console (`admin.eleva.care`)
   uses a host-only `__Host-` cookie (Phase 12). Cookie tossing on a shared-domain cookie is
   mitigated by the signed cookie value, duplicate-session-cookie rejection
   (`SESSION_COOKIE_AMBIGUOUS`) and the `*.eleva.care` DNS inventory — the threat model is D-13
   in the decision log, written in Phase 2 and signed as the Phase 4 PR 04.2 entry gate.
5. **Accounts.** Required: `account: { encryptOAuthTokens: true }` (Better Auth encrypts
   Google/Microsoft tokens with `BETTER_AUTH_SECRET`; Phase 2 has an integration check that
   fails if the flag is missing or false). `@eleva/calendar` reads tokens through
   `auth.api.getAccessToken({ body: { accountId } })` (ADR-004 amended). Account linking:
   `accountLinking.disableImplicitLinking: true`, `trustedProviders: ["google"]` only for
   explicit `linkSocial()` after a verified magic-link session; a Google sign-in whose
   e-mail matches an existing user returns `account_not_linked` (ADR-019). No linking by
   unverified e-mail match.
6. **Consumers.** Frontends use exactly three entry points from `@eleva/auth`: `client`
   (`createAuthClient` with the matching client plugins), `server` (`getSession()` — a
   `React.cache`d fetch of `/auth/get-session` forwarding cookies) and `proxy`
   (`getSessionCookie()` optimistic check in each app's `proxy.ts`; authorization is always
   re-checked server-side). `apps/api` routes use `requireApiAuth`, which accepts exactly one
   credential per request: session cookie (with origin check), `Authorization: Bearer <jwt>`
   or `x-api-key`.
7. **Provisioning.** `databaseHooks.user.create.after` creates the personal Space
   (`{firstName}'s Space`, type `personal`) inside `withAudit`; org switching is
   `organization.setActive`; guest bookings create a user with `emailVerified = false` that the
   activation magic link completes (Phase 4).
8. **Rollout.** Phase 2 = expand (create `auth.*`, backfill from `main.users/organizations/memberships`,
   dual-read behind a flag); Phase 3 = contract (drop `workos_*` columns, delete
   `@workos-inc/*`, `infra/workos`, Widgets wrappers and `@radix-ui/themes`). `WORKOS_*` env vars
   are removed in Phase 3.

## Alternatives Considered

### Keep WorkOS

- Pros: already integrated in the MVP; AuthKit UI; enterprise SSO/SCIM available.
- Cons: per-org pricing against a one-org-per-user model; identity data outside our Neon
  project; RBAC and Widgets configured out-of-band; Vault and Pipes create a second data plane;
  sync job needed to mirror orgs/memberships.

### Neon managed Better Auth (Neon Auth)

- Pros: zero hosting; same Neon project.
- Cons: Beta; partial `organization` plugin; no MFA/passkeys; no `databaseHooks`/custom
  plugins; no control over cookie domain and `trustedOrigins`. Rejected until it reaches parity.

### Auth.js / Lucia / Clerk / Supabase Auth

- Auth.js: sessions and OAuth only — organizations, RBAC, API keys, passkeys and MFA would be
  bespoke. Lucia: deprecated as a library. Clerk / Supabase Auth: hosted, same residency and
  pricing shape as WorkOS.

## Consequences

- Positive: identity data in the EU Neon project under one DPA; RBAC versioned with code; API
  keys and JWTs for agents from the same server; passkeys and MFA without a vendor add-on;
  WorkOS invoice removed after Phase 3.
- Tradeoff: Eleva operates the auth server (patching, secret rotation, rate limits) — covered by
  `.cursor/skills/better-auth/SKILL.md` and the Phase 13 hardening checklist.
- Operational: `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` become required in every environment;
  `security-traceability.md` gains the session/CSRF rows; `apps/api` becomes a hard dependency of
  every sign-in (its SLO covers auth).
- Supersedes in part: ADR-004 (calendar tokens now in Better Auth `account` rows), ADR-015 (the
  "one WorkOS Application per environment" section), ADR-016 (the "consistent with WorkOS Widgets"
  rationale — the embedded-widgets paradigm stands on its own), ADR-022 decision 6 (the
  `@radix-ui/themes` peer disappears with Phase 3).

## Related

- [`identity-rbac-spec.md`](../identity-rbac-spec.md), [ADR-020](ADR-020-envelope-encryption.md),
  [ADR-021](ADR-021-rbac-ssot-in-code.md), [ADR-019](ADR-019-mvp-migration-and-cutover.md)
- [`execution-plan/phases/02-better-auth-foundation.md`](../execution-plan/phases/02-better-auth-foundation.md),
  [`03-remove-workos.md`](../execution-plan/phases/03-remove-workos.md)
- Better Auth docs (Context7 `/better-auth/better-auth`): options reference, organization,
  admin, api-key, passkey, magic-link, jwt/bearer plugins, Next.js integration.
