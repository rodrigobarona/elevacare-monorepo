# Phase 2 — Better Auth foundation (server, schema, client, account UI)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branch     | `phase-02/better-auth-foundation` (split: `phase-02.0/spike-better-auth`, `phase-02.1/auth-server-schema`, `phase-02.2/auth-clients-account-ui`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Depends on | Phase 1. **Spike PR 02.0** (`phase-02.0/spike-better-auth`, evidence only, max 2 days) must be merged before PR 02.1 opens: a throwaway Better Auth instance on a Neon branch proves sign-up + email verification, personal Space provisioning, expert org creation and switching, cross-subdomain session on `*.dev.eleva.care`, TOTP + passkey options (attestation is 02.2 Playwright), API key, opaque bearer session, JWT/JWKS, admin role, Google linking and session revocation; report in `docs/eleva-v3/spikes/02-better-auth.md` with the exact package/plugin versions to pin and any option renames the plan must absorb |
| Effort     | 2 weeks (highest risk phase)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Touches    | `packages/auth/**`, `packages/db/**`, `apps/api/src/app/auth/**`, `apps/api/src/lib/auth.ts`, `apps/api/src/app/{organizations,memberships,onboarding}/**`, `apps/account/**`, `packages/dashboard/**`, `packages/email/**`, `pnpm-workspace.yaml`                                                                                                                                                                                                                                                                                                                                                                                   |
| Exit gate  | Sign up -> personal Space -> create Expert org -> switch org -> RLS isolation test green; 2FA + passkeys + magic link + Google work; API accepts session cookie, Bearer session token, API key, JWT; Playwright auth spec green                                                                                                                                                                                                                                                                                                                                                                                                      |

## Why this phase exists

Identity is the foundation for every other surface. This phase stands up the Better Auth server
inside `apps/api`, generates the `auth` schema, migrates domain tables to reference Better Auth
IDs, and rebuilds `@eleva/auth` helpers plus the `apps/account` sign-in/sign-up/settings UI.
WorkOS code that is not on the identity path (Vault, Pipes, seat meter, widgets) is removed in
Phase 3.

## Scope

In:

- `pnpm-workspace.yaml` catalog: pin `better-auth`, `@better-auth/passkey`,
  `@better-auth/api-key`, `@better-auth/drizzle-adapter` at **1.7.3** (spike 02.0).
  `@better-auth/stripe` is **not** used. `@better-auth/cli` is lagged at 1.4.22
  and **must not** generate the 1.7 Drizzle schema. Author
  `packages/db/src/schema/auth` from the 1.7.3 table list in
  `docs/eleva-v3/spikes/02-better-auth.md`, then `drizzle-kit generate`. Do
  **not** call `getMigrations` against the Drizzle adapter (that API is
  Kysely-only). Do not wait for a later CLI generate.
- `packages/auth/src/server/auth.ts`: the only `better-auth` server import. Options per ADR-017.
  Export `auth`, `type Session`, `type AuthUser`, `type AuthOrganization`.
- `packages/auth/src/permissions.ts` (`createAccessControl`, statements, roles) and
  `capabilities.ts` deriving from it; delete `widget-scopes.ts`, `workos-client.ts`, `sync.ts`.
- `packages/auth/src/client.ts` (`createAuthClient` with plugins `organizationClient`,
  `adminClient`, `twoFactorClient`, `passkeyClient`, `magicLinkClient`, `apiKeyClient`),
  `packages/auth/src/server.ts` (`getSession()` = React.cache over
  `apiClient.auth.getSession({ headers })` from `@eleva/api-client` — the typed client gains an
  `auth.getSession` method with the Better Auth session response Zod schema; no ad-hoc `fetch`;
  `requireSession()`, `requireOrg()`), `packages/auth/src/proxy.ts`
  (`getSessionCookie` optimistic guard, `return-to` handling preserved), `guards.ts`,
  `org-routing.ts`, `react.tsx` (`PermissionGate` reading capabilities from session).
- `packages/db/src/schema/auth/*` authored from the 1.7.3 table list in
  `docs/eleva-v3/spikes/02-better-auth.md` (or a 1.7-compatible Better Auth
  generate), moved into the `auth` Postgres schema; `packages/db/src/schema/main`: repoint FKs to
  `auth.user.id` / `auth.organization.id` and keep the `users`, `organizations`, `memberships`,
  `roles`, `permissions` mirrors and every `workos_*` column in place, read-only (expand step —
  see the expand-and-contract bullet below; Phase 3 drops them); add `org_data_keys` (used in Phase 3);
  update RLS helper `withOrgContext` to accept the active org from the session; regenerate
  migrations; update seeds (`db:seed:demo`).
- `apps/api/src/app/auth/[...all]/route.ts` mounting `toNextJsHandler(auth)`; CORS allow-list
  from `trustedOrigins`; `apps/api/src/lib/auth.ts` `requireApiAuth()` accepting, in this order and with an explicit discriminator per
  mode: session cookie; `Authorization: Bearer <token>` where a compact JWS (three base64url
  segments with a `kid` header) is verified as a JWT against `/auth/jwks` (jwt plugin) and any
  other opaque value is verified as a Better Auth session token (bearer plugin) — the two never
  share a verifier; API keys only via the `x-api-key` header (apiKey plugin), never as Bearer.
  **Exactly one credential source per request**: before any verification, count the sources
  present (session cookie, `Authorization` header, `x-api-key`); more than one -> 400
  `AMBIGUOUS_CREDENTIALS` (audited), so a request can never be silently authenticated as a
  principal other than the one the caller intended.
  Tests cover cross-mode rejection (session token sent where a JWT is required and vice versa,
  API key sent as Bearer -> 401 with a distinct error code) and every credential pair
  (cookie+Bearer, cookie+API key, Bearer+API key, all three -> 400). Remove `x-eleva-workos-*` bridge
  headers.
- `apps/api/src/app/organizations/*`, `memberships/*`, `onboarding/*`, `users/avatar`: call
  `auth.api.*` (createOrganization, setActiveOrganization, addMember, etc.) inside `withAudit`;
  OpenAPI merge of Better Auth's `openAPI` plugin spec into `GET /openapi.json`.
- Provisioning: `databaseHooks.user.create.after` creates the personal Space
  (`{firstName}'s Space`, `type: personal`) idempotently, wrapped in `withAudit`.
- Email: `@eleva/email` templates for verify-email, reset-password, magic-link, org-invitation,
  2FA OTP (React Email; `pt`, `en`, `es`).
- `apps/account`: replace `(auth)/login|signup|callback|logout` with shadcn forms on
  `@eleva/auth/client`: email+password, magic link, Google, 2FA enrol/verify (TOTP + backup codes),
  passkeys (register/list/delete), active sessions list + revoke, org switcher via
  `organization.setActive`; keep `/account/settings`, `/account/workspaces/*` flows working.
- `packages/dashboard`: delete `workos-widgets-*` files and CSS; rewrite `switch-org-action.ts`
  to call `authClient.organization.setActive` server-side via API; `nav-user.tsx` reads Better
  Auth session.
- Playwright `e2e/auth.spec.ts`: sign up, verify email (test inbox or dev bypass), land on personal
  Space, create Expert workspace, switch org, sign out, sign in with magic link.

- **Cookie, CSRF and subdomain threat model (D-13, review P1)** — written in this phase, before
  the session code, as `docs/eleva-v3/security/cookie-csrf-threat-model.md` (linked from
  `identity-rbac-spec.md`); the security owner's sign-off is NOT part of this phase (see the end
  of this bullet): the session cookie is `Domain=.eleva.care`,
  `Secure`, `HttpOnly`, `SameSite=Lax`, `__Secure-` prefixed; the staff console is the exception
  (`admin.eleva.care` host-only cookie — Phase 12); every state-changing route requires
  **either** a non-cookie credential (`Authorization` / `x-api-key`) **or** the Better Auth
  origin check (`Origin`/`Sec-Fetch-Site` against `trustedOrigins`) — the `requireApiAuth`
  single-credential rule already rejects mixed credentials, this adds the cross-site rule for
  the cookie path; `trustedOrigins` is the explicit env list (never a wildcard), preview
  deployments target the staging API and never mint `.eleva.care` cookies. **Cookie tossing is
  a real exposure of a `Domain=.eleva.care` cookie and the `__Secure-` prefix does NOT close it**
  (it only forces `Secure`; any `*.eleva.care` host can still set a same-name parent-domain
  cookie, and `__Host-` is not an option for a cookie that must be shared across the app
  subdomains). The controls, each with a test: (1) the session cookie value is **signed** by
  Better Auth with `BETTER_AUTH_SECRET` — an unsigned or foreign-signed value is a 401, never a
  session; (2) **duplicate-cookie rejection**: if the request carries more than one cookie with
  the session name (the tossing signature — browsers send both), `requireApiAuth` and the
  Better Auth session reader treat the request as unauthenticated, answer 401
  `SESSION_COOKIE_AMBIGUOUS`, clear both (`Max-Age=0` on the parent domain and on the host) and
  log a security event — they never pick "the first one"; (3) **trusted-subdomain control**: no
  user-controlled or third-party host may exist under `eleva.care` — org slugs live in paths,
  never in hostnames; the only non-first-party name is the Daily CNAME `sessions.eleva.care`,
  which is why it is listed as a named risk in the threat model (a compromised or misbehaving
  page there could set a `.eleva.care` cookie — controls 1 and 2 are what defend against it) and
  why every `*.eleva.care` DNS record is inventoried in `environment-matrix.md` with an owner
  and reviewed each phase; the staff console uses a host-only `__Host-` cookie (Phase 12) because
  it does not need sharing. Tests: tossed cookie (second same-name cookie from a subdomain,
  unsigned) -> 401 `SESSION_COOKIE_AMBIGUOUS` + both cleared; forged-signature cookie -> 401;
  cross-site POST with cookie only -> 403 `CSRF_ORIGIN_MISMATCH`; same-site with cookie -> 200;
  Bearer from any origin
  -> 200; API key from any origin -> 200. Recorded in `decision-log.md` as D-13 (**proposed** —
  this phase writes the threat model and the tests; the security sign-off is a Phase 4 entry
  gate: PR 04.2 cannot open until D-13 carries owner, date and evidence).
- **Expand-and-contract for identity tables (review P1)**: this phase **expands** — creates the
  `auth.*` schema, backfills `auth.user/organization/member` from the current `main.users`,
  `main.organizations`, `main.memberships` (idempotent script under `packages/db/scripts/`),
  repoints every FK with `NOT VALID` constraints then `VALIDATE CONSTRAINT` in a separate
  statement, keeps the legacy tables read-only (trigger raising on write) and keeps `workos_*`
  columns nullable. Nothing is dropped here. Phase 3 **contracts**: drops the legacy tables and
  `workos_*` columns after the Phase 3 exit-gate grep and a row-count parity check pass. This
  is what makes Phase 2 revertible without data loss.

Out: calendar credentials, encryption, billing seat sync, infra deletion, **dropping legacy
identity tables/columns** (Phase 3).

## Deliverables

0. PR 02.0 spike report `docs/eleva-v3/spikes/02-better-auth.md` (the twelve contract checks
   above, each with the request made, the response observed and the Better Auth version); the
   pinned catalog versions PR 02.1 uses come from this report. Spike code is deleted before 02.1.
1. Catalog + `packages/auth/package.json` exports: `.`, `./client`, `./server`, `./proxy`,
   `./permissions`, `./react`.
2. `packages/auth/src/server/auth.ts`, `permissions.ts`, `capabilities.ts`, `client.ts`,
   `server.ts`, `proxy.ts`, `guards.ts`, `org-routing.ts`, `react.tsx`, tests.
3. `packages/db/src/schema/auth/*`, migration(s) in `packages/db/drizzle/main/*`, updated RLS
   helpers + `rls-isolation.test.ts`.
4. `apps/api/src/app/auth/[...all]/route.ts`, updated `lib/auth.ts`, updated organization/
   membership/onboarding routes, OpenAPI merge.
5. `@eleva/email` auth templates.
6. `apps/account` auth pages + settings security section; `packages/dashboard` cleanup.
7. `e2e/auth.spec.ts`.
8. `.env.example`, `turbo.json`, Vercel project env docs (`environment-matrix.md`): `BETTER_AUTH_SECRET`,
   `BETTER_AUTH_URL`, `ELEVA_COOKIE_DOMAIN`, `ELEVA_TRUSTED_ORIGINS`, `GOOGLE_OAUTH_CLIENT_ID/SECRET`,
   `MICROSOFT_OAUTH_CLIENT_ID/SECRET`, `PASSKEY_RP_ID`, `PASSKEY_ORIGIN`.

## Acceptance criteria

- [ ] PR 02.0 spike report committed under `docs/eleva-v3/spikes/02-better-auth.md`; every one of
      the twelve contract checks is marked proven or has a plan change recorded next to it.
- [ ] `rg -n 'better-auth' -g '!packages/auth/**' -g '!pnpm-lock.yaml' -g '!docs/**' -g '!pnpm-workspace.yaml'`
      returns nothing (boundary lint; matches `import`, `from` and `require` forms).
- [ ] `GET https://api.<env>/auth/ok` returns 200; `GET /openapi.json` includes `/auth/*` paths.
- [ ] Sign up -> email verified -> personal Space exists (`organization.type = personal`) with
      `member.role = owner`, audited (`audit_outbox` row).
- [ ] Create Expert workspace from `/account/workspaces/new` -> `organization.type = expert`,
      switch active org, `apps/expert` reads `session.activeOrganizationId`.
- [ ] 2FA TOTP enrol + verify + backup codes; passkey register + sign-in; magic link sign-in;
      Google sign-in of an existing email returns `account_not_linked`; linking is
      `linkSocial()` after a verified session (`disableImplicitLinking`, ADR-017).
- [ ] Cookie/CSRF threat model written and recorded as D-13 **proposed** in `decision-log.md`
      (sign-off is the Phase 4 PR 04.2 entry gate, not a Phase 2 deliverable); cross-site
      cookie-only POST -> 403 `CSRF_ORIGIN_MISMATCH`; tossed/duplicate session cookie -> 401
      `SESSION_COOKIE_AMBIGUOUS`; Bearer/API key from any origin -> 200 (tests).
- [ ] Legacy `main.users/organizations/memberships` still present and read-only after this PR;
      row-count parity script prints `auth.* == main.*` for users, orgs, memberships; every FK
      validated (`pg_constraint.convalidated = true`).
- [ ] `requireApiAuth()` accepts: cookie session; `Authorization: Bearer <session token>`;
      `x-api-key` created via `apiKey` plugin scoped to an org; JWT from `/auth/token` verified
      via JWKS (Bearer value routed by shape: compact JWS -> JWT verifier, anything else ->
      session-token verifier). JWTs are short-lived (`15m`) and **non-revocable** (JWKS only;
      no session-table check). After `revoke-other-sessions`, cookie/opaque bearer of that
      session return 401 and a JWT minted before revoke still verifies until `exp`. Unit tests
      for all four plus that revoke contract, plus cross-mode rejection (JWT where a
      session token is expected and vice versa, API key as Bearer -> 401) and mixed-source
      rejection (any two or three credential sources on one request -> 400 `AMBIGUOUS_CREDENTIALS`).
- [ ] RLS isolation test green on Neon branch in CI; `db:seed:demo` works from empty DB.
- [ ] Playwright `auth.spec.ts` green on the PR preview or local stack.
- [ ] Cookies set on `.eleva.care` in staging (verify via browser devtools on `dev.eleva.care`).

## Tests

- vitest: `permissions.test.ts` (every role maps to expected capabilities), `session.test.ts`,
  `requireApiAuth.test.ts` (4 auth modes + rejection), `rls-isolation.test.ts`.
- Playwright: `e2e/auth.spec.ts`.

## Docs to update

- `identity-rbac-spec.md` (final field names), `api-contract-spec.md` (auth section),
  `environment-matrix.md`, `AGENTS.md` (facts), `decision-log.md`.

## Local references

- `packages/auth/src/*` (all files; understand `capabilities.ts`, `provisioning.ts`,
  `org-routing.ts`, `return-to.ts`, `proxy.ts` behaviors to preserve).
- `packages/db/src/schema/main/{users,organizations,memberships,roles,permissions,shared}.ts`,
  `packages/db/src/rls.ts` or equivalent `withOrgContext` implementation, `packages/db/drizzle/**`.
- `apps/api/src/lib/auth.ts`, `apps/api/src/lib/openapi.ts`, `apps/api/src/lib/cors.ts`,
  `apps/api/src/app/{organizations,memberships,onboarding,users}/**`.
- `apps/account/src/app/**`, `apps/account/src/proxy.ts`, `packages/dashboard/src/*`.
- `packages/email/src/**`, `packages/audit/src/types.ts` (extend entity/action unions).
- `infra/workos/rbac-config.json`, `infra/workos/widgets-config.json` (source for permissions.ts).
- ADR-017, ADR-021, `identity-rbac-spec.md` (as rewritten in Phase 1).

## External docs

- Better Auth `/better-auth/better-auth`: installation, Next.js integration (`toNextJsHandler`,
  `nextCookies`), database (Drizzle adapter, `schema` option; author tables from
  the 02.0 list — do not run `@better-auth/cli` generate), plugins
  organization (access control, hooks, `setActive`, invitations), admin, two-factor, passkey,
  magic-link, bearer, jwt (JWKS), api-key, open-api, cookies (`crossSubDomainCookies`,
  `getSessionCookie`), rate limiting + `secondaryStorage`, `databaseHooks`, `trustedOrigins`,
  `account.encryptOAuthTokens`, `accountLinking`.
- Drizzle `/drizzle-team/drizzle-orm`: `pgSchema`, FKs across schemas, `drizzle-kit generate`.
- Next.js 16 `/vercel/next.js`: route handlers, `proxy.ts`, `cookies()`/`headers()`.
- Upstash Redis `/upstash/redis-js` (secondary storage).
- React Email `/resend/react-email`.

## Risks

- Better Auth package split or option renames: verify with Context7 on day one and pin versions.
- Cross-subdomain cookies in preview deployments: previews must target the staging API
  (`NEXT_PUBLIC_API_URL`), documented in `environment-matrix.md`.
- Repointing FKs breaks existing seeds and queries: run typecheck + tests continuously; grep for
  `main.users`, `main.organizations`, `main.memberships` — they become read-only here and are
  dropped only in Phase 3 (expand-and-contract), so a Phase 2 revert loses no data.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (especially better-auth.mdc, api-first-agentic.mdc,
   audit-wiring.mdc) and .cursor/skills/{better-auth,api-first-agentic,audit-wiring,coderabbit-review}/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/02-better-auth-foundation.md in full.
3. Read every file under "Local references" of this phase. Pull Better Auth, Drizzle, Next.js 16,
   Upstash Redis and React Email docs through Context7 (resolve-library-id then query-docs) and
   prefer those docs over memory. Verify the current Better Auth package layout (core vs split
   plugin packages) and pin versions in the pnpm catalog.

Workflow (mandatory) — this is the outer loop; the "PHASE 2 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-02.0/spike-better-auth
- Then, after each merge: phase-02.1/auth-server-schema, then phase-02.2/auth-clients-account-ui. Each PR: <= 30 files / 400 lines where possible; split above 60 / 800 and always before 100 reviewable files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
  or the review cap is reached (README section 4 rule 4: max 3 rounds, zero Critical/Major left,
  remaining Minor/Trivial listed in the PR body "Deferred findings" table with a reason each).
- Commit with Conventional Commits. Run: pnpm review:branch -> fix -> repeat until clean or
  the cap (max 2 rounds, same exit rule).
- git push -u origin HEAD && gh pr create --base main using the PR body template from
  docs/eleva-v3/execution-plan/README.md section 8.
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved comments and all green
  (after 2 App rounds escalate leftovers to the reviewer — README section 4 rule 6).
  Request approval from @rodrigobarona. gh pr merge --squash --delete-branch. Repeat for 02.2.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for every app's required locales (pt/en/es; apps/admin
pt/en only — decision-log staff-only exception), cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 2 TASK — Stand up self-hosted Better Auth as the identity system (ADR-017, ADR-021).

PR 02.0 — spike (throwaway code under packages/auth/spikes/, a Neon branch, evidence is the
deliverable): stand up a minimal Better Auth server with the ADR-017 plugin set and prove, in
docs/eleva-v3/spikes/02-better-auth.md (request, response, version for each): sign-up + email
verification; personal Space provisioning hook; expert organization creation; organization
switching (active org on the session); cross-subdomain cookie on *.dev.eleva.care; passkey and
TOTP enrolment + verify; API key create + authenticate; opaque bearer session token; JWT + JWKS
verification from a second process; admin role check; Google account linking by email (record
the threat model notes); session revocation propagating to every client. Record the exact
package layout (core vs split plugin packages) and pin those versions in the report. Where the
observed behaviour differs from this phase file, write the plan change into the report and apply
it to this file in the same PR. Delete the spike code before PR 02.1 opens.

PR 02.1 — server + schema + API:
1. Catalog: add better-auth (+ any required split plugin packages) to pnpm-workspace.yaml catalog;
   add to packages/auth and packages/db as "catalog:". Do not add @better-auth/stripe.
2. packages/auth/src/server/auth.ts (ONLY file importing better-auth server APIs):
   Imports (spike-pinned 1.7.3): drizzleAdapter from `@better-auth/drizzle-adapter`,
   apiKey from `@better-auth/api-key`, passkey from `@better-auth/passkey`, nextCookies
   from `better-auth/next-js` (last plugin), the rest from `better-auth/plugins`.
   betterAuth({
     baseURL: process.env.BETTER_AUTH_URL, basePath: "/auth", secret: BETTER_AUTH_SECRET,
     database: drizzleAdapter(db(), { provider: "pg", schema: authSchema }),
     emailAndPassword: { enabled: true, requireEmailVerification: true, sendResetPassword },
     emailVerification: { sendVerificationEmail, autoSignInAfterVerification: true },
     socialProviders: { google: { clientId, clientSecret, accessType: "offline", prompt: "consent" },
                        microsoft: { clientId, clientSecret, tenantId: "common" } },
     account: { encryptOAuthTokens: true, accountLinking: { enabled: true,
       disableImplicitLinking: true, trustedProviders: ["google"] } },
     session: { cookieCache: { enabled: true, maxAge: 300 }, expiresIn: 60*60*24*30, updateAge: 60*60*24 },
     advanced: { crossSubDomainCookies: { enabled: true, domain: process.env.ELEVA_COOKIE_DOMAIN ?? ".eleva.care" },
                 useSecureCookies: process.env.NODE_ENV === "production", database: { generateId: "uuid" } },
     trustedOrigins: from ELEVA_TRUSTED_ORIGINS (comma list) with defaults for prod, dev.eleva.care,
       admin hosts, and http://localhost:3000-3009,
     rateLimit: { enabled: true, storage: "secondary-storage" }, secondaryStorage: Upstash Redis
       adapter (KV_REST_API_URL / KV_REST_API_TOKEN),
     databaseHooks: { user: { create: { after: provisionPersonalSpace } } },
     plugins: [ organization({ ac, roles, schema: { organization: { additionalFields: { type: { type: "string", required: true, defaultValue: "personal" }, slug handling } } },
                               organizationHooks: audit + seat-sync stubs, allowUserToCreateOrganization: true,
                               creatorRole: "owner", membershipLimit: 200 }),
                admin({ ac: adminAc, roles: adminRoles, defaultRole: "user", adminRoles: ["platform_admin"] }),
                  // 1.7.3 throws if adminRoles names a role missing from `roles`
                twoFactor({ issuer: "Eleva.care" }), passkey({ rpID, rpName: "Eleva.care", origin }),
                magicLink({ sendMagicLink }), bearer(),
                jwt({ jwt: { expirationTime: "15m" } }), // short-lived, non-revocable — see requireApiAuth
                apiKey({ enableMetadata: true }),
                openAPI({ path: "/reference", disableDefaultReference: true }), nextCookies() ]
   }).
   Provision personal Space in the user.create.after hook: idempotent (check by ownerUserId +
   type=personal), name `${firstName}'s Space`, slug from user id, wrapped in withAudit
   (entity "organization", action "created"). Emails go through @eleva/email (Resend client
   inside @eleva/email is TEMPORARY: Phase 8 makes @eleva/email renderer-only and routes auth
   mail through @eleva/notifications — do not add other Resend call sites) with
   localized templates (pt/en/es) — add templates verify-email, reset-password, magic-link,
   organization-invitation, two-factor-otp.
3. packages/auth/src/permissions.ts: createAccessControl statements for org, members,
   invitations, billing, bookings, schedule, event_types, records, reports, invoicing,
   integrations, admin_users, admin_payouts, admin_accounting, admin_flags; roles owner/admin/
   member for organizations; platform roles user/staff_support/staff_finance/platform_admin for
   the admin plugin. Port every capability currently in infra/workos/rbac-config.json.
   capabilities.ts derives product labels from (organization.type, member.role) exactly like the
   current implementation; keep capabilities.test.ts green and extend it.
4. packages/db: author Drizzle tables in packages/db/src/schema/auth/index.ts from the
   1.7.3 list in docs/eleva-v3/spikes/02-better-auth.md (user, session, account,
   verification, organization, member, invitation, twoFactor, passkey, jwks, apikey)
   using pgSchema("auth") — do **not** run `@better-auth/cli` generate. Then
   drizzle-kit generate. Make apiKey.referenceId and
   organization.type first-class. Migrate main schema with EXPAND-AND-CONTRACT — this PR only
   expands: backfill auth.user / auth.organization / auth.member from main.users,
   main.organizations, main.memberships (packages/db/scripts/backfill-auth-identity.ts,
   idempotent, prints parity counts; a --verify flag runs read-only and exits non-zero on ANY
   of: count mismatch per table; a legacy row (main.users/organizations/memberships) whose
   mapped auth.* row is missing or has a different email/slug/(user, org, role) tuple — checked
   key by key, not by count; a repointed FK column anywhere in main.* whose value has no
   matching auth.user.id / auth.organization.id (orphan scan over every FK listed below, using
   the information_schema); it prints the offending ids (capped at 50 per check) — Phase 3 gates
   its contract migration on this exit code);
   every FK that pointed at the legacy tables now points at
   auth.user.id or auth.organization.id (expert_profiles, clinic_profiles, billing_customers,
   billing_subscriptions, expert_integrations, bookings, schedules, event_types, audit_outbox
   actor fields, etc.) added as NOT VALID then VALIDATE CONSTRAINT in a separate migration
   statement; legacy tables get a BEFORE INSERT/UPDATE/DELETE trigger that raises (read-only);
   workos_* columns stay, nullable. DO NOT drop users, organizations, memberships, roles,
   permissions or any workos_* column in this phase — Phase 3 contracts after its exit-gate
   grep and the parity check. Add org_data_keys(org_id FK auth.organization,
   key_version int, kek_version text, wrapped_dek bytea, created_at, retired_at) with RLS.
   Update withOrgContext to keep the eleva.org_id contract; RLS policies unchanged in semantics.
   Regenerate migrations (drizzle-kit generate) and make db:seed:demo and db:seed:categories
   work from an empty database. Add/extend rls-isolation.test.ts.
5. apps/api: create src/app/auth/[...all]/route.ts exporting { GET, POST } = toNextJsHandler(auth)
   with CORS allow-list from trustedOrigins (credentials true). Better Auth does not ship
   GET /auth/ok — add a 200 JSON health next to the handler. JWT default alg is EdDSA;
   verify GET /auth/token with jose + /auth/jwks (never hardcode RS256). Organization
   list is GET /auth/organization/list. session.cookieCache is not a revoke source of
   truth — requireApiAuth must call auth.api.getSession. JWTs from `/auth/token` are
   **short-lived and non-revocable**: `jwt({ jwt: { expirationTime: "15m" } })` (Better
   Auth 1.7.3 default). The JWT verifier checks signature + `iss`/`aud`/`exp`/`alg`
   (EdDSA) only — it must **not** look up `session` after JWKS verify. `revoke-other-sessions`
   and sign-out kill cookie, opaque bearer, and API-key sessions immediately; a JWT minted
   before revoke stays valid until `exp`. Privileged mutations (sign-out, billing, membership,
   org switch) MUST use cookie or opaque bearer, never JWT. 02.1 integration test: mint JWT,
   revoke that session, JWKS verify still succeeds, cookie/bearer of that session return 401.
   Rewrite src/lib/auth.ts
   requireApiAuth() to resolve identity from (a) session cookie via auth.api.getSession({ headers }),
   (b) Authorization: Bearer <token>: if the value is a compact JWS (three base64url segments,
   kid header) verify it as a JWT with JWKS from /auth/jwks (jwt plugin), otherwise verify it as
   a Better Auth session token (bearer plugin) — one discriminator, two verifiers, never both;
   (c) x-api-key (apiKey plugin -> referenceId = orgId; an API key sent as Bearer is rejected).
   Before verifying anything, count the credential sources present (cookie, Authorization,
   x-api-key); if more than one is present return 400 AMBIGUOUS_CREDENTIALS (audited) — never
   pick the first match. Return { userId, orgId, roles, capabilities, authMode }. Unit tests:
   each mode succeeds alone, each cross-mode combination is rejected with a distinct error code,
   and each credential pair (cookie+Bearer, cookie+API key, Bearer+API key, all three) -> 400.
   Remove x-eleva-workos-* headers.
   Update organizations, organizations/mine, memberships, onboarding/complete,
   onboarding/sync-existing (delete if obsolete), users/avatar to call auth.api.* inside
   withAudit; register/adjust Zod schemas in src/lib/openapi.ts and merge the Better Auth
   openAPI plugin document into GET /openapi.json. Keep rate limiting on every route.
6. Tests: permissions.test.ts, requireApiAuth.test.ts (4 modes + 401/403), rls-isolation.test.ts,
   provisioning hook test (idempotent). Update @eleva/api-client for changed endpoints.
7. .env.example, turbo.json globalEnv, docs/eleva-v3/environment-matrix.md: BETTER_AUTH_SECRET,
   BETTER_AUTH_URL, ELEVA_COOKIE_DOMAIN, ELEVA_TRUSTED_ORIGINS, GOOGLE_OAUTH_CLIENT_ID,
   GOOGLE_OAUTH_CLIENT_SECRET, MICROSOFT_OAUTH_CLIENT_ID, MICROSOFT_OAUTH_CLIENT_SECRET,
   PASSKEY_RP_ID, PASSKEY_ORIGIN.

PR 02.2 — clients, proxy, account UI, dashboard:
8. packages/auth/src/client.ts: createAuthClient({ baseURL: `${NEXT_PUBLIC_API_URL}/auth`,
   fetchOptions: { credentials: "include" }, plugins: [organizationClient({ ac, roles }),
   adminClient(), twoFactorClient(), passkeyClient(), magicLinkClient(), apiKeyClient()] }).
   packages/auth/src/server.ts: getSession() = React.cache(async () =>
   apiClient.auth.getSession({ headers: await headers() })) — add auth.getSession to
   @eleva/api-client (GET /auth/get-session, forwards the cookie header, response parsed with a
   SessionResponseSchema exported from the client; never a hand-written fetch), plus
   requireSession(), requireOrg(), getCapabilities(). packages/auth/src/proxy.ts: keep the
   existing return-to and org-routing behavior but use getSessionCookie(request) from
   better-auth/cookies for the optimistic redirect; never query the DB in proxy.ts (<50 LOC per
   app proxy). Update guards.ts, org-routing.ts, react.tsx (PermissionGate reads capabilities from
   the session payload). Delete widget-scopes.ts, workos-client.ts, sync.ts, upload-token.ts if
   only used by WorkOS flows (otherwise port). Update package.json exports.
9. apps/account: replace src/app/(auth)/{login,signup,callback,logout} with pages built on
   @eleva/ui + @eleva/auth/client: /login (email+password, magic link, Google, passkey), /signup
   (name, email, password, consent checkbox with legal links), /verify-email, /reset-password,
   /two-factor (verify TOTP or backup code), /logout (server action calling signOut). Settings:
   /account/settings gets a Security section (change password, 2FA enrol with QR + backup codes,
   passkeys list/add/remove, active sessions list/revoke). Org switcher and /account/workspaces/*
   use organization.setActive and createOrganization through @eleva/api-client. All Server
   Actions validate with Zod and authenticate inside the action.
10. packages/dashboard: delete workos-widgets-config.ts, workos-widgets-locale.ts,
    workos-widgets-messages.ts, workos-widgets-overrides.css, workos-widgets-pt-PT.json and their
    imports; rewrite switch-org-action.ts to call the API (setActive) and revalidate; nav-user.tsx
    and org-switcher*.tsx read the Better Auth session shape. Remove dead CSS from sources.css.
11. e2e/auth.spec.ts (Playwright): sign up -> verify -> personal Space visible -> create Expert
    workspace -> switch -> sign out -> magic link sign in. Use data-testid selectors. Verification
    in tests reads the token from the Better Auth `verification` table through a Playwright DB
    fixture (local Postgres and the staging Neon branch), so no bypass is needed in
    production-like stacks. The optional bypass route POST /auth/e2e/verify-email is
    development/preview only and fails closed: the module
    is excluded from the production bundle (registered only when process.env.VERCEL_ENV !==
    "production" AND process.env.E2E_AUTH_BYPASS_TOKEN is set; missing token => route not
    mounted, request => 404), it compares the token with timingSafeEqual, it is rate limited,
    and every call is audited (entity "user", action "email_verified", payload { via: "e2e" }).
    Guards: an apps/api startup assertion (apps/api/src/lib/env.ts) throws when
    E2E_AUTH_BYPASS_TOKEN is present while VERCEL_ENV === "production"; environment-matrix.md
    lists the variable in a new "development/preview only — never production" table and the
    Phase 15 gate checklist verifies with `vercel env ls --environment production` that it is
    absent; unit test: with VERCEL_ENV=production the route table has no /auth/e2e/* path, and
    a request to it returns 404.
12. Cookie/CSRF/subdomain threat model: write docs/eleva-v3/security/cookie-csrf-threat-model.md
    (cookie attributes Domain=.eleva.care Secure HttpOnly SameSite=Lax __Secure- prefix; admin
    host-only exception; origin check for cookie-authenticated mutations via Better Auth
    trustedOrigins + Sec-Fetch-Site, error CSRF_ORIGIN_MISMATCH 403; explicit trustedOrigins
    env list, never wildcard; previews never mint .eleva.care cookies; *.eleva.care DNS
    inventory in environment-matrix.md) and implement the origin check in requireApiAuth's
    cookie path only (Bearer and API-key paths are exempt); implement duplicate-session-cookie
    rejection (more than one cookie with the session name -> 401 SESSION_COOKIE_AMBIGUOUS, clear
    both, security log) and rely on the signed cookie value — __Secure- alone does not stop
    cookie tossing on a Domain=.eleva.care cookie; tests for the six cases; record D-13 in
    decision-log.md with Status: proposed, owner: security, review date — do NOT write a
    sign-off here: the security owner signs it as the Phase 4 PR 04.2 entry gate.
13. Docs: identity-rbac-spec.md final field names, api-contract-spec.md auth section,
    AGENTS.md facts, decision-log.md entries (D-13 + Better Auth adoption), security-traceability.md rows.

Acceptance (verify and paste evidence in the PR): boundary grep clean; GET /auth/ok 200;
/openapi.json includes /auth paths; sign-up creates personal Space + audit row; Expert workspace
creation + switch works; 2FA, passkey, magic link, Google linking work; requireApiAuth accepts
all four modes with tests; RLS isolation green on the Neon branch; auth.spec.ts green; cookies on
.eleva.care in staging.

Report: files changed, migrations added, test results, CodeRabbit CLI finding counts per run,
PR URLs, and any env vars the owner must set in Vercel (all eight projects).
```
