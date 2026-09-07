# Phase 13 — Hardening, observability, i18n parity, performance, full E2E

| Field      | Value                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-13/hardening-observability` (split: `phase-13.1/security-observability`, `phase-13.2/i18n-performance-e2e`)                                                                                                                                                                                                                                               |
| Depends on | Phase 12                                                                                                                                                                                                                                                                                                                                                         |
| Effort     | 1.5 weeks                                                                                                                                                                                                                                                                                                                                                        |
| Touches    | `packages/observability/**`, `apps/*/src/proxy.ts`, `apps/api/src/lib/{rate-limit,bot-protection,security-headers}.ts`, `packages/analytics/**` (new, PostHog) or `packages/observability`, `apps/web` (GA4 + consent banner), `e2e/**`, `.github/workflows/**`, all `messages/*.json`, `docs/eleva-v3/**` checklists                                            |
| Exit gate  | `security-hardening-checklist.md` fully ticked; Sentry (EU) redaction verified; BetterStack heartbeats for every QStash job + status page live; PostHog EU with consent; i18n parity 100% for `pt/en/es`; Core Web Vitals budgets green on staging; full Playwright suites (auth, booking, member, expert onboarding, team, admin, video join) green on every PR |

## Why this phase exists

Before migrating real users, the platform must be secure, observable and measurable. Most items
already exist in scattered form; this phase closes gaps and wires enforcement into CI.

## Scope

In:

- **Security**: BotID on every public POST that a browser or end user originates (booking
  reserve, payments intent, signup, become-partner, contact forms, AI endpoints). Signed
  machine-to-machine endpoints are explicitly **out of BotID scope** and authenticate by
  signature only: `/webhooks/stripe`, `/webhooks/daily`, `/webhooks/resend`, `/webhooks/twilio`,
  `/workflows/*` (QStash `Receiver.verify`), Better Auth `/auth/*` (own rate limiting). The
  coverage checker encodes that allowlist; Upstash rate limits per route class from
  `security-hardening-checklist.md` (auth 10/min/IP, public reads 120/min/IP, mutations
  60/min/user for authenticated callers, `publicMutation` 20/min per `route + client IP` for the
  guest-callable Phase 4 routes `/bookings/reserve`, `/payments/intent`, `/bookings/confirm` —
  plus a per-reservation sub-limit of 10/min keyed by `reservationId` so one IP cannot hammer
  many reservations and one reservation cannot be hammered from many IPs — admin 300/min/user); strict CSP with nonces composed in `@eleva/observability`
  and applied in every `proxy.ts` via shared helper (`report-uri` to Sentry), HSTS preload,
  `Permissions-Policy`, `Referrer-Policy`, `X-Frame-Options: DENY` everywhere (it cannot
  express a cross-origin allow-list; `ALLOW-FROM` is obsolete) — Stripe/Daily iframes that _we_
  embed are governed by CSP `frame-src`; **third-party embedding of Eleva pages is unsupported at
  launch** — any future embeddable route needs an ADR and must both drop `X-Frame-Options` and
  set a route-specific CSP `frame-ancestors` (DENY + relaxed frame-ancestors is contradictory);
  the helper is route-aware (`{ route: { mediaCapture, embeddable } }`) so Permissions-Policy
  grants camera/microphone only on the two join routes (`apps/app` and `apps/expert`); CSP
  `frame-src`/`connect-src`/`media-src` include the branded Daily domain (`DAILY_DOMAIN`) when
  configured; Better Auth `rateLimit` rules for `/sign-in/*`, `/magic-link`,
  `/two-factor/*`; `useSecureCookies` + `sameSite: "lax"`; secret rotation runbook
  (`BETTER_AUTH_SECRET` dual-key, KEK v2 via `rotateKek`, Stripe webhook secret, Daily webhook
  secret, TOConline tokens); dependency audit (`pnpm audit --prod`, Renovate/Dependabot config);
  CORS allow-list audit; OpenAPI exposure review (`/openapi.json` public but admin tag hidden).
- **Observability**: Sentry EU DSN per app with `tracesSampleRate`, `beforeSend` scrubbing (PHI
  and names removed; on server/edge runtimes emails are replaced by a keyed HMAC-SHA256 with
  `SENTRY_USER_HASH_KEY`, a secret Sentry never receives — a plain hash is a stable,
  dictionary-recoverable identifier; on the client runtime the secret must never ship, so the
  browser `beforeSend` drops email/name entirely and sets `user.id` only), release tagging via Vercel git SHA, source maps; structured logging (`pino` or
  console JSON) with correlation id propagated from `x-request-id` through `withAudit`;
  BetterStack heartbeats for every QStash job (each workflow route pings on success), uptime
  monitors for `eleva.care`, `api.eleva.care/health`, `admin.eleva.care`, `sessions.eleva.care`;
  public status page (`status.eleva.care`); alert routing to on-call.
- **Analytics**: GA4 on `apps/web` only; PostHog EU (`eu.i.posthog.com`) in authenticated apps via
  `@eleva/analytics` (server + client helpers, `identify` with user id only, no PHI, feature flag
  bridge optional); consent banner in `apps/web` and first-login consent in apps (categories:
  necessary, analytics, marketing) stored in `consents` and honored by GA4/PostHog/Resend Lane 2.
  `analytics` is a **distinct consent kind**: this phase appends `analytics` to `CONSENT_KINDS`
  in `@eleva/compliance` (Phase 5 const; Phase 10 appended `session_recording`/`ai_processing`),
  regenerates the `consent_kind` pg enum with a migration, extends the `/me/consents` Zod
  schemas and adds tests — `marketing` consent never implies analytics and vice versa
  ("necessary" is not stored; it is not a choice).
- **i18n**: parity CI already exists (Phase 1); this phase fills every missing key in `pt/en/es`
  (and `pt-BR` if kept), translates legal pages, email templates per locale, error messages from
  API error codes -> localized copy map in `@eleva/i18n`; `hreflang` and locale switch tested.
- **Performance**: budgets in `lighthouserc` (LCP < 2.5s, CLS < 0.1, INP < 200ms on profile and
  explorer), `use cache` on explorer/profile/categories, image optimization (`next/image` with
  Blob loader), bundle analysis (`@next/bundle-analyzer`) with per-app limits, `optimizePackageImports`,
  dynamic import of heavy client libs (Daily, Stripe Connect JS, editors); Lighthouse CI job on
  staging URLs.
- **E2E**: full Playwright suites `auth`, `booking`, `member`, `expert-onboarding`, `team`,
  `admin`, `video-join`, `invoicing-manual`; run on PR against the Vercel preview (or local
  stack) with seeded data (`db:seed:e2e`), sharded; flaky test policy.
- **Runbooks**: incident response, on-call rotation, backup/restore drill (Neon PITR), DR
  checklist.

Out: penetration test (external vendor, scheduled before Phase 15 — record as an operator task).

## Deliverables

1. Security header/CSP helper + per-app `proxy.ts` updates; rate-limit classes; BotID coverage
   list test (a test that asserts every public POST route imports the BotID guard).
2. `@eleva/observability` Sentry init per runtime, redaction tests, correlation id middleware,
   BetterStack heartbeat helper + registration of monitors (`infra/betterstack/` script).
3. `@eleva/analytics` (PostHog EU) + consent banner + consent storage; GA4 in `apps/web`.
4. i18n completion; localized API error map; email templates per locale verified.
5. Performance budgets + Lighthouse CI workflow + bundle analyzer config.
6. Playwright suites + `e2e` workflow update (sharding, preview URL, seed).
7. Runbooks in `integration-runbooks.md`, `ops-observability-spec.md`, `security-hardening-checklist.md`
   (ticked), `service-level-objectives.md` (final SLOs).

## Acceptance criteria

- [ ] `security-hardening-checklist.md` items all ticked with links to code/CI.
- [ ] CSP report-only run on staging for 48h shows zero violations from first-party code; then
      enforced.
- [ ] Rate-limit tests hit 429 at the configured thresholds for each class.
- [ ] Sentry receives a test error from every app with redacted payload and release tag.
- [ ] Every QStash job has a heartbeat; deliberately pausing one triggers an alert (test then
      resume).
- [ ] Status page public; uptime monitors green.
- [ ] PostHog events flow only after analytics consent; GA4 only in `apps/web` after consent.
- [ ] `check:i18n-parity` green with zero `TODO` values; legal pages exist in all locales.
- [ ] Lighthouse CI budgets green on staging profile/explorer/home.
- [ ] Full E2E suite green on PR and on `main`.

## Tests

- vitest: redaction, rate-limit classes, CSP builder snapshot, consent gating of analytics.
- Playwright: all suites.
- Lighthouse CI.

## Docs to update

- `security-hardening-checklist.md`, `ops-observability-spec.md`, `service-level-objectives.md`,
  `integration-runbooks.md`, `testing-strategy.md`, `environment-matrix.md`
  (`SENTRY_DSN_*`, `NEXT_PUBLIC_POSTHOG_KEY`, `BETTERSTACK_*`, `NEXT_PUBLIC_GA4_ID`), `decision-log.md`.

## Local references

- `packages/observability/src/**`, `apps/api/src/lib/{rate-limit,bot-protection,security-headers,cors}.ts`,
  `apps/*/src/proxy.ts`, `packages/i18n/**` or `packages/config/src/i18n.ts`, `apps/*/messages/*.json`,
  `e2e/**`, `.github/workflows/{ci,e2e}.yml`, `docs/eleva-v3/{security-hardening-checklist,ops-observability-spec,service-level-objectives,testing-strategy}.md`, ADR-011.
- MVP: `_context/clone-repo/eleva-care-app/src/lib/integrations/posthog/**`, `sentry.*.config.ts`,
  `middleware.ts` CSP as parity reference.

## External docs

- Sentry Next.js `/getsentry/sentry-javascript` (EU region, `beforeSend`, source maps).
- PostHog JS + Next.js `/posthog/posthog-js` (EU host, consent), Vercel Analytics.
- BetterStack heartbeats/uptime API (official docs).
- Next.js 16 CSP with nonces, `optimizePackageImports`, `next/image` loaders `/vercel/next.js`.
- Lighthouse CI `/googlechrome/lighthouse-ci`; Playwright sharding `/microsoft/playwright`.
- Upstash Ratelimit `/upstash/ratelimit-js`; Vercel BotID docs.

## Risks

- CSP breaking Stripe/Daily embeds: use report-only first; keep allow-lists in one place.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (api-first-agentic, audit-wiring, eleva-icons, better-auth,
   daily-video) and .cursor/skills/{api-first-agentic,coderabbit-review}/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/13-hardening-observability.md in full.
3. Read every file under "Local references". Pull Sentry Next.js, PostHog JS (EU), Next.js 16 CSP/
   optimizePackageImports/next-image, Lighthouse CI, Playwright sharding, Upstash Ratelimit and
   BotID docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory) — this is the outer loop; the "PHASE 13 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-13.1/security-observability
  (second PR: phase-13.2/i18n-performance-e2e). Each under 150 reviewable files (message JSON
  files count — split further by app if needed).
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity && pnpm e2e
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
  or the review cap is reached (README section 4 rule 4: max 3 rounds, zero Critical/Major left,
  remaining Minor/Trivial listed in the PR body "Deferred findings" table with a reason each).
- Commit with Conventional Commits. Run: pnpm review:branch -> fix -> repeat until clean or
  the cap (max 2 rounds, same exit rule).
- git push -u origin HEAD && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green
  (after 2 App rounds escalate leftovers to the reviewer — README section 4 rule 6); request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for every app's required locales (pt/en/es; apps/admin
pt/en only — decision-log staff-only exception), cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 13 TASK — Harden, observe, localize, speed up, and test the whole platform.

PR 13.1 — security + observability + analytics:
1. Security headers: in @eleva/observability add buildSecurityHeaders({ app, nonce, reportOnly, route })
   — the single signature every caller uses; route is the policy object described below and is
   REQUIRED (no default), so a proxy cannot forget it —
   producing CSP (default-src 'self'; script-src 'self' 'nonce-…' https://js.stripe.com
   https://connect-js.stripe.com https://eu.i.posthog.com (apps) https://www.googletagmanager.com
   (web only); connect-src self api host, wss/https *.daily.co, sessions.eleva.care,
   https://api.stripe.com, PostHog EU, Sentry EU; frame-src https://js.stripe.com
   https://connect-js.stripe.com https://*.daily.co plus the branded Daily domain when configured
   (DAILY_DOMAIN, e.g. https://sessions.eleva.care — the helper reads it from @eleva/env, so
   frame-src, connect-src and media-src all include it); img-src self data: blob: *.public.blob.
   vercel-storage.com; media-src self blob: *.daily.co and the branded domain; report-uri Sentry),
   HSTS preload,
   Permissions-Policy (camera/microphone/display-capture only on join routes), Referrer-Policy
   strict-origin-when-cross-origin, X-Content-Type-Options nosniff, X-Frame-Options DENY plus CSP
   frame-ancestors 'none' on every route (never ALLOW-FROM; frame-src above covers the iframes
   we embed; third-party embedding is unsupported at launch — a future embeddable route must, via
   a new ADR, pass { route: { embeddable: true } } which OMITS X-Frame-Options and sets the
   route-specific frame-ancestors, never both). route is
   { mediaCapture: boolean; embeddable: boolean }, computed by an exported
   routePolicyForPathname(app, pathname) helper (mediaCapture true for the Phase 9 join pages in
   BOTH apps — /[orgSlug]/sessions/[bookingId]/join in apps/app AND in apps/expert — and false
   everywhere else; embeddable always false at launch) so proxies never hand-write the policy;
   unit tests cover the app join route, the expert join route, an embeddable route and a normal
   route, assert that X-Frame-Options and frame-ancestors are consistent, and assert frame-src
   contains the branded Daily domain when DAILY_DOMAIN is set and only *.daily.co when it is
   not. Apply from every apps/*/src/proxy.ts via
   one helper call (keep proxies < 50 LOC) and in apps/api security-headers.ts with
   route: routePolicyForPathname("api", pathname). Start report-only
   on staging (env CSP_REPORT_ONLY=true), enforce after 48h clean.
2. Rate limits: apps/api/src/lib/rate-limit.ts exposes classes auth (10/min/IP), publicRead
   (120/min/IP), mutation (60/min/user — requires a session/API-key principal; throws at startup
   if a route without an auth model declares it), publicMutation (20/min keyed by route + client
   IP from the Vercel-provided x-real-ip / x-vercel-forwarded-for, never x-forwarded-for from the
   body; plus an optional second key such as reservationId at 10/min — used by the guest-callable
   /bookings/reserve, /payments/intent, /bookings/confirm; never a single global bucket), admin
   (300/min/user), webhook (none, signature only); every route declares its class; tests: guest
   traffic to /bookings/reserve from one IP is limited at 20/min, two IPs get independent
   buckets, 11 calls for one reservationId from different IPs -> 429; test asserting every route file imports a rate limit and an
   auth model (static analysis script scripts/check-route-guards.mjs added to CI). BotID: guard
   every browser- or user-originated public POST (reserve, payments intent, sign-up proxies,
   become-partner submit, contact, AI endpoints); two exemption classes, both declared in one
   place (scripts/check-botid-coverage.mjs, added to CI): (1) signed M2M routes — /webhooks/*
   (provider signature) and /workflows/* (QStash Receiver.verify) — for which the script fails
   unless the route file both imports the trusted verifier (verifyStripeSignature /
   Receiver.verify from the shared helpers, not a local reimplementation) and calls it before any
   body parsing or side effect (AST check, not a string match), and unless a colocated test sends
   an invalid signature and asserts 401 with no side effect; (2) /auth/* — the single Better Auth
   catch-all handler, exempt because Better Auth applies its own rate limiting — for which the
   script instead asserts that packages/auth/src/server/auth.ts enables rateLimit with
   customRules for /sign-in/*, /sign-up/*, /magic-link, /two-factor/*, /forget-password (and a
   unit test exercises the limiter). The script fails when a public POST is neither
   BotID-guarded nor in one of those two classes. CORS allow-list
   review. Dependabot or Renovate config for weekly grouped updates; pnpm audit --prod in CI
   (fail on high). Secret rotation runbook in integration-runbooks.md (BETTER_AUTH_SECRET,
   ELEVA_KEK_V2 with rotateKek, Stripe/Daily/Resend webhook secrets, TOConline).
3. Observability: @eleva/observability Sentry init for server/edge/client per app (EU DSN env
   SENTRY_DSN_<APP>, tracesSampleRate 0.1, replays off in apps handling PHI, beforeSend scrubbing:
   drop names and record bodies; on server/edge replace emails with
   HMAC-SHA256(SENTRY_USER_HASH_KEY, email) (never a plain or unsalted hash; the key is a
   server-only env var, never NEXT_PUBLIC_); on the client drop email and name entirely and keep
   only user.id (the secret must not reach the browser bundle — add a test that the client Sentry
   config has no reference to SENTRY_USER_HASH_KEY); unit tests reject raw emails, plain sha256 of
   an email and any base64/hex that decodes to an email; release = VERCEL_GIT_COMMIT_SHA; source maps upload in
   build), request correlation id (x-request-id generated in proxy, propagated to API, stored on
   audit rows and logs), structured JSON logger with redaction, BetterStack: infra/betterstack/
   setup-monitors.ts registering uptime monitors (eleva.care, api/health, admin, sessions) and one
   heartbeat per QStash job; each workflow route pings its heartbeat URL on success; status page
   status.eleva.care documented; alert policy to on-call email/SMS.
4. Analytics: packages/analytics (@eleva/analytics): PostHog EU client/server helpers (identify by
   user id only, group by org id, no PHI, autocapture off, feature flag bridge optional), consent
   gate reading the analytics consent; GA4 only in apps/web after consent. Add the distinct
   consent kind first: append analytics to CONSENT_KINDS in @eleva/compliance (never reuse
   marketing), regenerate the consent_kind pg enum via a @eleva/db migration, extend the
   GET/PUT /me/consents Zod schemas + OpenAPI + @eleva/api-client, versioned text
   packages/compliance/legal/analytics.<locale>.md, and tests (granting marketing does not enable
   PostHog; granting analytics does; withdrawing stops events). Consent banner component in
   @eleva/ui used by apps/web (necessary/analytics/marketing; necessary is informational, not
   stored) and a first-login consent step in apps (stored in consents table; Lane 2 marketing sync
   respects marketing only).
5. Docs: security-hardening-checklist.md ticked with links, ops-observability-spec.md,
   service-level-objectives.md, environment-matrix.md, decision-log.md.

PR 13.2 — i18n, performance, E2E:
6. i18n: fill every missing key for each app's required locales (pt/en/es; apps/admin pt/en per
   REQUIRED_LOCALES_BY_APP) across apps (check:i18n-parity must be clean with no
   placeholder values), legal pages in all locales, email templates verified per locale, API error
   code -> localized message map in @eleva/i18n used by apps for toasts; locale switch e2e.
   Decide pt-BR (alias or full) per decision-log.
7. Performance: lighthouserc.json with budgets (LCP 2.5s, CLS 0.1, INP 200ms, TBT 300ms) on
   apps/web home, explorer, profile; .github/workflows/lighthouse.yml against the Vercel preview
   URL; use cache + cacheTag on explorer/profile/categories; next/image with Blob loader;
   @next/bundle-analyzer per app with size limits in CI (size-limit or custom script);
   optimizePackageImports for @eleva/ui, @eleva/icons; dynamic import for Daily, Stripe Connect JS,
   Markdown editor; remove unused deps (knip report).
8. E2E: e2e/{auth,booking,member,expert-onboarding,team,admin,video-join,invoicing-manual}.spec.ts
   with page objects, data-testid selectors, seeded data via pnpm db:seed:e2e (new script);
   .github/workflows/e2e.yml sharded 4x, runs against the preview URL (Vercel deployment status
   check) with fallback to local stack; retries 1; flaky quarantine tag policy in
   testing-strategy.md.
9. Runbooks: incident response, on-call, Neon PITR restore drill (perform once on a branch and
   record), DR checklist in integration-runbooks.md; operator task: schedule external penetration
   test before Phase 15.

Acceptance (paste evidence): checklist ticked; CSP report-only clean then enforced; 429 tests;
Sentry test events redacted per app; heartbeat alert drill; status page; consent-gated
analytics; i18n parity clean; Lighthouse budgets green; full E2E green on PR and main.

Report: files changed, CI jobs added, monitors created, tests, CodeRabbit CLI counts, PR URLs,
operator tasks pending (pen test, status page DNS, on-call contacts).
```
