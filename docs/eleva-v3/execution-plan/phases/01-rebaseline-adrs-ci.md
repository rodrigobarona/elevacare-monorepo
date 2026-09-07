# Phase 1 — Re-baseline: ADR-017..021 + ADR-023, handbook, rules, CI foundations

| Field      | Value                                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-01/rebaseline-adrs-ci`                                                                                                                                                                                        |
| Depends on | Phase 0                                                                                                                                                                                                              |
| Effort     | 1 week                                                                                                                                                                                                               |
| Touches    | `docs/eleva-v3/**`, `AGENTS.md`, `.cursor/rules/**`, `.cursor/skills/**`, `.coderabbit.yaml`, `.github/workflows/**`, `e2e/**`, `playwright.config.ts`, `packages/db/drizzle/audit/**`, `.env.example`, `turbo.json` |
| Exit gate  | Handbook has zero WorkOS-as-decision statements; ADR-017..021 + ADR-023 accepted; CI runs lint/typecheck/build/vitest/e2e-smoke/rls-isolation on a Neon branch per PR; audit DB migrations committed                 |

## Why this phase exists

The handbook (`docs/eleva-v3/`) is authoritative but WorkOS-locked. Agents and humans read it
first, so it must describe the new target (Better Auth, Daily-only, envelope encryption, RBAC in
code, MVP migration) before any code changes. The CI foundations (Playwright, Neon branch per PR,
audit migrations) are needed by Phase 2's acceptance tests.

## Scope

In:

- ADR-017 Better Auth, ADR-018 Daily-only video, ADR-019 MVP migration + cutover, ADR-020
  envelope encryption, ADR-021 RBAC SSOT in code, ADR-023 Plate rich-text editor in
  `@eleva/editor` (ADR-022 React Aria already exists). Update `adrs/README.md` index; mark ADR-004
  (Pipes section) and ADR-015 (one WorkOS application) as superseded-in-part with pointers.
- Rewrite `identity-rbac-spec.md` for Better Auth (tables, plugins, roles, product labels,
  session model, cross-subdomain cookies, agent auth via API keys/JWT).
- Update `README.md` canon, `master-architecture.md`, `vendor-decision-matrix.md`,
  `compliance-data-governance.md` (WorkOS removed as subprocessor; Daily.co HIPAA/BAA; Better Auth
  is self-hosted so no new subprocessor), `calendar-integration-spec.md` (tokens via Better Auth
  `account` table), `environment-matrix.md` (fix `dev.eleva.care` vs `staging.eleva.care` drift,
  add `sessions.eleva.care`, add `BETTER_AUTH_*`, `ELEVA_KEK_V1`, `DAILY_*`), `decision-log.md`,
  `roadmap-and-milestones.md` + `implementation-sprints.md` (banner: superseded by
  `execution-plan/`), `workos-multi-app.md` (delete; content folded into ADR-017/identity spec),
  `security-hardening-checklist.md`, `launch-readiness-checklist.md`, `integration-runbooks.md`,
  `owner-map.md`.
- `AGENTS.md`: replace WorkOS facts with Better Auth facts (keep structure; keep Spaces naming,
  members wording, cookies, icons, routing model).
- `.cursor/rules`: delete `workos-events-sync.mdc`, `workos-rbac-widgets.mdc`; add
  `better-auth.mdc` (boundary: only `packages/auth` imports `better-auth`; frontends use
  client/server/proxy helpers; permissions SSOT), `daily-video.mdc` (only `packages/video` imports
  `@daily-co/*`; random room names; meeting tokens; PHI-free logs), `encryption.mdc` (envelope
  rules; KEK never logged; `ELEVA_KEK_V*` naming). `.cursor/skills`: delete `workos-rbac-widgets`,
  add `better-auth` skill (how to add a plugin, regenerate schema, add a permission).
- `.coderabbit.yaml` path_instructions: `packages/auth/**`, `packages/video/**`,
  `packages/encryption/**`, `packages/accounting/**`, `e2e/**`; remove WorkOS wording.
- CI: `.github/workflows/e2e.yml` (Playwright smoke against `pnpm build && pnpm start` of
  `apps/web` + `apps/api` with mocked externals, or against the Vercel preview URL when
  available); Neon branch-per-PR job using `neondatabase/create-branch-action` + migrations +
  `packages/db` RLS isolation tests; `i18n-parity` job (script compares keys across
  `messages/{pt,en,es}.json` for every app); delete-branch job on PR close.
- Root Playwright: `playwright.config.ts`, `e2e/smoke.spec.ts` (web home 200, api `/health` 200,
  `/openapi.json` valid JSON).
- Audit DB: run `pnpm --filter=@eleva/db db:generate:audit` (create the script if missing) and
  commit the migrations folder; document in `schema-and-migration-rules.md`.
- `.env.example` + `turbo.json` `globalEnv`: add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `ELEVA_KEK_V1`, `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `MICROSOFT_OAUTH_CLIENT_ID/SECRET`,
  `DAILY_API_KEY`, `DAILY_DOMAIN`, `DAILY_WEBHOOK_SECRET`; mark `WORKOS_*` as "removed in Phase 3".

Out: any runtime code change (Phase 2+), deleting WorkOS packages (Phase 3).

## Deliverables

1. `docs/eleva-v3/adrs/ADR-017-better-auth-identity.md`
2. `docs/eleva-v3/adrs/ADR-018-daily-video-only.md`
3. `docs/eleva-v3/adrs/ADR-019-mvp-migration-and-cutover.md`
4. `docs/eleva-v3/adrs/ADR-020-envelope-encryption.md`
5. `docs/eleva-v3/adrs/ADR-021-rbac-ssot-in-code.md`
   5b. `docs/eleva-v3/adrs/ADR-023-plate-rich-text-editor.md`
6. Handbook edits listed above; `identity-rbac-spec.md` rewritten.
7. `AGENTS.md`, `.cursor/rules/*`, `.cursor/skills/*`, `.coderabbit.yaml` updated.
8. `.github/workflows/e2e.yml`, `.github/workflows/neon-branch.yml` (or jobs inside `ci.yml`),
   `scripts/check-i18n-parity.mjs`, `playwright.config.ts`, `e2e/smoke.spec.ts`,
   `@playwright/test` in the catalog.
9. `packages/db/drizzle/audit/*` migrations committed; `db:generate:audit` / `db:migrate:audit`
   scripts.
10. `.env.example`, `turbo.json` updated.

## Acceptance criteria

- [ ] `rg -n "WorkOS" docs/eleva-v3 --glob '!**/decision-log.md' --glob '!**/adrs/**' --glob '!**/execution-plan/**'`
      returns only historical mentions explicitly marked "(removed, see ADR-017)". The execution
      plan is excluded on purpose: its blast-radius section and Phase 3 describe the removal.
- [ ] `adrs/README.md` lists ADR-017..021 and ADR-023 as Accepted with dates.
- [ ] CI on this PR shows jobs: lockfile-guard, install, lint, typecheck, build, test, e2e-smoke,
      neon-branch-migrate-and-rls, i18n-parity — all green.
- [ ] Neon branch is created on PR open and deleted on PR close (verify in Neon console or via
      `neonctl branches list`).
- [ ] `packages/db/drizzle/audit` exists with at least the initial migration and journal.
- [ ] `.cursor/rules` contains `better-auth.mdc`, `daily-video.mdc`, `encryption.mdc` and no
      `workos-*.mdc`.

## Tests

- `pnpm test` (existing vitest), `pnpm exec playwright test` locally against dev servers,
  `node scripts/check-i18n-parity.mjs`.

## Docs to update

All listed in Scope. Add `decision-log.md` entries dated for ADR-017..021, ADR-023 and for "execution plan
supersedes sprints".

## Local references

- `docs/eleva-v3/README.md`, `master-architecture.md`, `identity-rbac-spec.md`,
  `workos-multi-app.md`, `environment-matrix.md`, `compliance-data-governance.md`,
  `calendar-integration-spec.md`, `vendor-decision-matrix.md`, `decision-log.md`,
  `adrs/ADR-003-tenancy-and-rls.md`, `adrs/ADR-004-scheduling-and-calendar-oauth.md`,
  `adrs/ADR-015-multi-app-split.md`, `adrs/README.md`, `testing-strategy.md`,
  `schema-and-migration-rules.md`.
- `AGENTS.md`, `.cursor/rules/workos-*.mdc`, `.cursor/skills/workos-rbac-widgets/SKILL.md`.
- `.github/workflows/ci.yml`, `.coderabbit.yaml`, `turbo.json`, `.env.example`.
- `packages/db/package.json`, `packages/db/drizzle.config.*`, `packages/db/src/schema/audit/*`.
- `packages/auth/src/*` (to describe accurately what will be replaced).

## External docs

- Better Auth: `/better-auth/better-auth` (concepts: database, plugins organization/admin/
  two-factor/passkey/magic-link/bearer/jwt/api-key/open-api, cookies cross-subdomain, Next.js
  integration).
- Neon branching GitHub Action: `/neondatabase/create-branch-action`, Neon docs
  `/websites/neon_com_docs` (branching, `neonctl`).
- Playwright: `/microsoft/playwright` (config, CI, webServer).
- Daily.co: `/websites/daily_co_reference_rest-api` (HIPAA mode constraints).
- Drizzle Kit: `/drizzle-team/drizzle-orm` (`drizzle-kit generate` with multiple configs).

## Risks

- Docs drift if code changes land before this merges: freeze code PRs until Phase 1 is merged.
- Neon action needs `NEON_API_KEY` + `NEON_PROJECT_ID` secrets in GitHub; request from owner.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc and the skills under .cursor/skills/ that match the files
   you will touch (api-first-agentic, audit-wiring, stripe-webhooks, eleva-icons, coderabbit-review).
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and this phase file in full
   (docs/eleva-v3/execution-plan/phases/01-rebaseline-adrs-ci.md).
3. Read every file under "Local references" of this phase. Pull every library under
   "External docs" through Context7 (resolve-library-id then query-docs) and prefer those docs
   over memory.

Workflow (mandatory) — this is the outer loop; the "PHASE 1 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-01/rebaseline-adrs-ci
- Implement the deliverables in the order listed. Keep the PR under 150 reviewable files; if the
  docs rewrite plus CI exceed it, split into phase-01.1/adrs-handbook and phase-01.2/ci-foundations.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build
- Run: pnpm review -> fix all findings -> repeat until clean or the review cap is reached (README
  section 4 rule 4: max 3 rounds, zero Critical/Major left, remaining Minor/Trivial listed in the
  PR body "Deferred findings" table with a reason each). Commit (Conventional Commits).
- Run: pnpm review:branch -> fix -> repeat until clean or the cap (max 2 rounds, same exit rule).
- git push -u origin HEAD && gh pr create --base main using the PR body template in
  docs/eleva-v3/execution-plan/README.md section 8.
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved comments and all green
  (after 2 App rounds escalate leftovers to the reviewer — README section 4 rule 6).
  Request human approval from @rodrigobarona. gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for every app's required locales (pt/en/es; apps/admin
pt/en only — decision-log staff-only exception), cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 1 TASK — Re-baseline docs, rules, and CI for the Better Auth / Daily / envelope-encryption
architecture. No runtime code changes in this phase.

A. ADRs (docs/eleva-v3/adrs/). Use the existing ADR format (Status, Date, Context, Decision,
   Alternatives Considered, Consequences). Write:
   - ADR-017-better-auth-identity.md: self-hosted Better Auth mounted in apps/api at /auth/*
     (basePath "/auth"), Drizzle adapter with schemaName "auth" on the main Neon project;
     plugins organization (custom access control, roles owner/admin/member, organization
     additionalFields.type in personal|expert|team|academy|staff, organizationHooks for
     provisioning/audit/seat sync), admin (roles user, staff_support, staff_finance,
     platform_admin), twoFactor, passkey, magicLink, bearer, jwt, apiKey, openAPI, nextCookies;
     advanced.crossSubDomainCookies domain ".eleva.care"; trustedOrigins list; session
     cookieCache; account.encryptOAuthTokens true; accountLinking.trustedProviders ["google"];
     rate limit storage via Upstash Redis secondaryStorage; email via @eleva/email (Resend).
     Frontends never instantiate the server; they use @eleva/auth/client, @eleva/auth/server
     getSession() (React.cache'd fetch to /auth/get-session forwarding cookies) and
     @eleva/auth/proxy getSessionCookie(). Alternatives: keep WorkOS; Neon managed Better Auth
     (rejected: Beta, partial organization plugin, no MFA, no hooks/custom plugins). Consequences:
     WorkOS Vault/Pipes/Widgets removed; RBAC moves to code (ADR-021); encryption to ADR-020.
   - ADR-018-daily-video-only.md: Daily.co is the only video provider; HIPAA-enabled domain
     elevacare.daily.co branded as sessions.eleva.care; private rooms with random names, nbf/exp
     around the booking, per-participant meeting tokens (expert is_owner), webhooks for
     meeting.started/ended, recording/transcript behind consent + feature flag; Google Meet
     dropped; calendars remain busy-time/destination only. Supersedes the Meet parts of ADR-004.
   - ADR-019-mvp-migration-and-cutover.md: migrate live MVP data (Neon) into v3 with idempotent
     dry-run-first scripts in infra/migration; same Stripe platform account (Connect accounts,
     customers, subscriptions carried over); passwords cannot leave WorkOS -> magic-link/set-
     password welcome campaign; Google accounts are linked ONLY from the WorkOS identity subject
     (idp_id) exported while WorkOS is live, never by e-mail matching; users without a stored
     subject sign in with the magic link and link Google through Better Auth accountLinking
     (trustedProviders ["google"], verified e-mail required); WorkOS Vault
     records decrypted before WorkOS cancellation and re-encrypted with @eleva/encryption; URL
     compatibility for /[username] and /[username]/[eventSlug]; DNS switch with rollback = DNS
     revert + MVP unfreeze.
   - ADR-020-envelope-encryption.md: @eleva/encryption = AES-256-GCM envelope encryption; per-org
     DEK stored wrapped in table org_data_keys (org_id, key_version, wrapped_dek, kek_version,
     created_at, retired_at); KEK from env ELEVA_KEK_V<n> (base64 32 bytes), versioned for
     rotation; API encryptForOrg/decryptForOrg/rotateKek/shredOrgKeys; ciphertext format
     v1:<kek_version>:<dek_version>:<iv>:<tag>:<data> base64; KEK never logged; crypto-shred =
     delete DEK rows. OAuth tokens are encrypted by Better Auth, not by this package.
   - ADR-021-rbac-ssot-in-code.md: permissions live in packages/auth/src/permissions.ts using
     Better Auth createAccessControl statements (resources: org, members, billing, bookings,
     schedule, records, reports, invoicing, admin.*) and roles; product labels derived from
     (organization.type, member.role) exactly as today; capability bundles in capabilities.ts
     derive from permissions.ts; infra/workos JSON files retired in Phase 3.
   - ADR-023-plate-rich-text-editor.md: every rich-text surface (expert bios, event-type
     descriptions, location instructions, clinical notes, reports, the template library, clinic
     pages) uses Plate (platejs) through ONE package @eleva/editor (packages/editor) created in
     Phase 4B; value stored as Plate JSON in jsonb + server-derived sanitized HTML + plain text
     (clients never send HTML); Plate UI components come from the Plate shadcn registry into
     packages/editor/src/components/ui and are restyled with @eleva/ui tokens; boundary lint:
     platejs, @platejs/*, slate* are importable only inside packages/editor, and @radix-ui/* is
     allowed there as an ADR-022 exception (alongside the transitional @radix-ui/themes WorkOS
     Widgets peer that Phase 3 removes); AI writing help (improve, shorten, fix grammar,
     translate pt/en/es) runs through @eleva/ai over the Vercel AI Gateway with the
     approved-models allow-list (clinical context only with zeroRetention models, Phase 10);
     alternatives: Tiptap (rejected: Pro extensions licensing for AI/comments), Lexical
     (rejected: thinner React ecosystem, no shadcn registry), per-app Markdown textareas
     (rejected: no templates, no AI, inconsistent UX). Consequences: one editor to theme, test and
     sanitize; Radix confined to one package; template library in Phase 10 is Plate JSON.
   Update docs/eleva-v3/adrs/README.md index. Add "Superseded in part by ADR-017/018/020" banners to
   ADR-004 (Pipes/Meet) and ADR-015 (single WorkOS Application). Add decision-log.md entries.

B. Handbook rewrite (docs/eleva-v3/). Rewrite identity-rbac-spec.md for Better Auth (tables user,
   session, account, verification, organization, member, invitation, twoFactor, passkey, apikey,
   jwks; personal Space provisioning in databaseHooks.user.create.after; org switch via
   organization.setActive; product labels; agent auth via API keys and JWT; session cookie on
   .eleva.care; proxy.ts optimistic check). Update README.md "Current Canon" (WorkOS line ->
   Better Auth line; Daily line; encryption line), master-architecture.md, vendor-decision-
   matrix.md, compliance-data-governance.md (remove WorkOS subprocessor, add Daily.co BAA/HIPAA,
   Better Auth self-hosted), calendar-integration-spec.md (tokens from Better Auth account table
   via auth.api.getAccessToken, scopes via linkSocial), environment-matrix.md (canonical staging
   host is dev.eleva.care; add sessions.eleva.care; env var table with BETTER_AUTH_SECRET,
   BETTER_AUTH_URL, ELEVA_KEK_V1, GOOGLE_OAUTH_CLIENT_ID/SECRET, MICROSOFT_OAUTH_CLIENT_ID/SECRET,
   DAILY_API_KEY, DAILY_DOMAIN, DAILY_WEBHOOK_SECRET; preview deployments call the staging API),
   security-hardening-checklist.md, launch-readiness-checklist.md, integration-runbooks.md,
   owner-map.md, testing-strategy.md (Playwright root suite, Neon branch per PR). Add a
   "Superseded by docs/eleva-v3/execution-plan/" banner at the top of roadmap-and-milestones.md
   and implementation-sprints.md. Delete workos-multi-app.md (fold anything still true into
   ADR-017 and identity-rbac-spec.md). Update the in-repo README "Learned Workspace Facts" for
   WorkOS in AGENTS.md: replace with Better Auth facts (one auth server in apps/api; client/
   server/proxy helpers; permissions.ts SSOT; cookie domain; org types; Spaces naming unchanged).

C. Cursor rules and skills. Delete .cursor/rules/workos-events-sync.mdc and
   workos-rbac-widgets.mdc and .cursor/skills/workos-rbac-widgets/. Add .cursor/rules/
   better-auth.mdc (globs packages/auth/**, apps/*/src/proxy.ts, apps/api/src/app/auth/**;
   rules: only packages/auth imports better-auth; frontends use @eleva/auth/client|server|proxy;
   every new permission goes in permissions.ts; regenerate schema with the Better Auth CLI into
   packages/db/src/schema/auth; wrap hooks in withAudit), daily-video.mdc (globs packages/video/**,
   apps/api/src/app/webhooks/daily/**; only packages/video imports @daily-co/*; random room names;
   tokens per participant; verify webhook signatures; no PHI in logs), encryption.mdc (globs
   packages/encryption/**; envelope rules; never log KEK/DEK/plaintext; tests with known vectors).
   Add .cursor/skills/better-auth/SKILL.md (add a plugin, regenerate schema + migration, add a
   permission + capability, add a trusted origin, rotate BETTER_AUTH_SECRET).

D. .coderabbit.yaml: remove WorkOS wording; add path_instructions for packages/auth/** (only
   place importing better-auth; permissions SSOT; hooks audited), packages/video/** (only
   @daily-co importer; tokens; signature verification), packages/encryption/** (no plaintext
   PHI, KEK never logged, versioned ciphertext), packages/accounting/** (TOConline host
   api33.toconline.pt; Tier 1 vs Tier 2 boundaries; IVA matrix reference), e2e/** (no secrets,
   stable selectors via data-testid).

E. CI foundations.
   - Add @playwright/test to the pnpm catalog and root devDependencies; create playwright.config.ts
     (projects: chromium; baseURL from E2E_BASE_URL; webServer optional) and e2e/smoke.spec.ts
     (apps/web home returns 200 and renders the hero; apps/api GET /health 200; GET /openapi.json
     parses and has openapi field). Add root scripts e2e and e2e:ui.
   - .github/workflows/e2e.yml: on pull_request; install; build apps/web and apps/api with
     placeholder env; start both; run smoke; upload playwright-report artifact.
   - Neon branch per PR: .github/workflows/neon-branch.yml using neondatabase/create-branch-action
     (needs NEON_API_KEY and NEON_PROJECT_ID secrets; document in environment-matrix.md and ask the
     owner to add them), then run pnpm --filter=@eleva/db db:migrate against the branch URL and the
     RLS isolation vitest in packages/db (create packages/db/src/__tests__/rls-isolation.test.ts
     if missing: two orgs, cross-org read returns zero rows under withOrgContext). Add a job that
     deletes the branch on pull_request closed (neondatabase/delete-branch-action).
   - scripts/check-i18n-parity.mjs: for every apps/*/messages directory read the app's
     required-locale list from packages/config/src/i18n-locales.ts (REQUIRED_LOCALES_BY_APP:
     default ["pt","en","es"]; apps/admin ["pt","en"] per the decision-log staff-only exception —
     the checker never hardcodes the list) and compare the key sets of those locale files (plus
     pt-BR.json when present); exit 1 on missing keys; add root script check:i18n-parity and a CI
     job; unit test: an app with es.json missing fails unless its list omits es.
   - Update ci.yml comments (remove the "placeholder jobs" block) and contribution-workflow.md
     required checks list.

F. Audit database migrations. Ensure packages/db has drizzle.config.audit.ts and scripts
   db:generate:audit / db:migrate:audit; run generate and commit packages/db/drizzle/audit/**
   (or the folder the config points to). Document in schema-and-migration-rules.md.

G. .env.example and turbo.json globalEnv: add the new variables listed in B; annotate WORKOS_*
   as "removed in Phase 3 (ADR-017)". Do not rename Upstash variables.

Acceptance: rg -n "WorkOS" docs/eleva-v3 --glob '!**/decision-log.md' --glob '!**/adrs/**'
--glob '!**/execution-plan/**' shows only entries marked "(removed, see ADR-017)" (the
execution plan is excluded on purpose; do not rewrite it to satisfy the grep); adrs/README.md lists ADR-017..021 and ADR-023 Accepted; CI shows e2e-smoke,
neon-branch-migrate-and-rls, i18n-parity green; packages/db audit migrations committed;
.cursor/rules has better-auth.mdc, daily-video.mdc, encryption.mdc and no workos-*.mdc.

Report: files changed, CI job names and results, CodeRabbit CLI finding counts per run, PR URL,
and any secrets the owner still needs to add.
```
