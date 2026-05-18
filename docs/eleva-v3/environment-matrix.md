# Eleva.care v3 Environment Matrix

Status: Authoritative

## Purpose

This document defines the intended environment model for Eleva.care v3.

It should help the team answer:

- which environments exist
- what each one is for
- how integrations differ by environment
- what data safety assumptions apply

## Principles

- Production and staging must be clearly separated.
- Preview or ephemeral environments should not be treated as production equivalents.
- Integration callbacks and secrets must be environment-specific.
- Sensitive-data behavior should be explicit per environment.

## Core Environments

### Local development

Purpose:

- individual development
- package/app integration
- local schema and workflow iteration

Characteristics:

- developer-owned
- may use sandbox/test providers
- should not require production secrets

### Staging

Purpose:

- integration verification
- QA
- launch rehearsal
- safe pre-production validation

Characteristics:

- shared team environment
- production-like config as much as practical
- test/sandbox provider accounts where appropriate

### Production

Purpose:

- live customer and expert usage

Characteristics:

- strict access controls
- production integrations
- full observability and operational readiness

## Preview Environments

If used, preview environments should be treated as:

- useful for UI and scoped feature review
- not necessarily full-fidelity integration environments

The team should document which integrations:

- are safe in previews
- are disabled in previews
- point to staging or sandbox targets

## Environment Concerns To Track

Each environment should clearly define:

- app URLs
- API URLs
- webhook callback targets
- auth redirect URLs
- calendar callback URLs
- email sending mode
- payment mode
- transcript/video mode
- analytics mode
- error monitoring/project routing

## Secrets And Config

Rules:

- do not share secrets across environments unless explicitly intended
- do not document raw secrets in handbook files
- keep environment-variable ownership clear

## DNS And Domain Ownership

- **Vercel manages the full DNS** for `eleva.care`. All records (A, AAAA, CNAME, MX, TXT) are controlled via Vercel Domains.
- Subdomain creation, DNS record updates, and certificate provisioning are first-class Vercel operations — no third-party DNS provider in the loop.
- Wildcard SSL covers `*.eleva.care`.

## Public Surface — App At Root + API On Subdomain (Multi-Zone, ADR-014)

Human-facing surfaces are served on the **single canonical domain** `eleva.care`. APIs (webhooks, OAuth callbacks, session-aware server endpoints) live on the dedicated `api.eleva.care` subdomain for clean separation of concerns.

### Zone map (ADR-015 multi-app split)

| App                 | Vercel project      | Root dir       | Domain / routing                                                        | Purpose                                                |
| ------------------- | ------------------- | -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| Gateway + marketing | `elevacare-web`     | `apps/web`     | `eleva.care/` root                                                      | Marketing, public profiles, booking, auth root routing |
| Member (patient)    | `elevacare-app`     | `apps/app`     | `eleva.care/[orgSlug]` via proxy                                        | Member dashboard, appointments, reviews                |
| Expert              | `elevacare-expert`  | `apps/expert`  | `eleva.care/[orgSlug]/expert/*` via proxy                               | Expert tools, scheduling, finance, Stripe Connect      |
| Team (clinic)       | `elevacare-team`    | `apps/team`    | `eleva.care/[orgSlug]/team/*` via proxy                                 | Team/clinic management, expert invitations             |
| Academy (future)    | `elevacare-academy` | `apps/academy` | `eleva.care/[orgSlug]/academy/*` via proxy                              | Lecturer course creation, LMS management               |
| Account             | `elevacare-account` | `apps/account` | `eleva.care/signin`, `/callback`, `/account/*`, `/onboarding` via proxy | Auth flows, profile, settings, onboarding              |
| Admin               | `elevacare-admin`   | `apps/admin`   | `admin.eleva.care` (subdomain)                                          | Platform ops, application approvals, payouts           |
| API                 | `elevacare-api`     | `apps/api`     | `api.eleva.care` (subdomain)                                            | Webhooks, OAuth callbacks, server endpoints            |
| Docs                | `elevacare-docs`    | `apps/docs`    | `eleva.care/docs/*` via multi-zone rewrite                              | ERS PT compliance docs                                 |

Rewrites live in `apps/web/next.config.mjs` and `apps/web/src/proxy.ts`. The gateway dispatches requests to the correct backend app: auth/account paths to `apps/account`, org-scoped second-segment matching (`expert`, `team`, `academy`) to their respective apps. Subdomain apps (`admin`, `api`) are independent projects with custom domains.

### Marketplace integrations per project

All apps share the same Neon project, Upstash Redis, and Vercel Blob stores. Connect Marketplace integrations so env vars are auto-provisioned:

| Integration               | web | app | api | account | admin | expert | team | academy |
| ------------------------- | --- | --- | --- | ------- | ----- | ------ | ---- | ------- |
| **Neon Postgres**         | --  | YES | YES | YES     | YES   | YES    | YES  | YES     |
| **Upstash Redis**         | --  | --  | YES | --      | --    | --     | --   | --      |
| **Upstash QStash**        | --  | --  | YES | --      | --    | --     | --   | --      |
| **Vercel Blob (public)**  | --  | --  | YES | YES     | --    | YES    | --   | --      |
| **Vercel Blob (private)** | --  | --  | YES | YES     | --    | YES    | --   | --      |

### Context-sensitive root

| State           | `eleva.care/`                                                           | `eleva.care/home`                                         |
| --------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| Unauthenticated | marketing home                                                          | marketing home                                            |
| Authenticated   | **302 redirect** to role home (`/[orgSlug]`, `/[orgSlug]/expert`, etc.) | marketing home (always; escape hatch for logged-in users) |

### Third-party-hosted surfaces (still subdomains)

Some surfaces are not Vercel-hosted and cannot be path-rewritten:

| Subdomain             | Host             | Purpose                                             |
| --------------------- | ---------------- | --------------------------------------------------- |
| `status.eleva.care`   | BetterStack      | public status page, uptime + incident communication |
| `sessions.eleva.care` | Daily.co (CNAME) | branded video session URLs                          |

### Public API subdomain

`api.eleva.care` serves the `elevacare-api` Vercel project. It's a dev/server-facing surface (webhooks, OAuth callbacks, session-aware server endpoints); humans don't browse it. CORS configuration:

- `Access-Control-Allow-Origin: https://eleva.care` (exact; `https://staging.eleva.care` in staging; specific `*.preview.eleva.care` host in preview)
- `Access-Control-Allow-Credentials: true`
- `robots.txt` disallow (don't index; no HTML anyway)

Cookies scoped to `.eleva.care` make session-aware calls from the gateway/app work cross-origin with credentials.

### Internal-only subdomains

These exist for operational purposes but are **never shared with users**:

| Subdomain            | Host                                 | Purpose                                      |
| -------------------- | ------------------------------------ | -------------------------------------------- |
| `app.eleva.care`     | `elevacare-app` (`apps/app`)         | Proxy rewrite target for member routes       |
| `account.eleva.care` | `elevacare-account` (`apps/account`) | Proxy rewrite target for auth/account routes |
| `expert.eleva.care`  | `elevacare-expert` (`apps/expert`)   | Proxy rewrite target for expert routes       |
| `team.eleva.care`    | `elevacare-team` (`apps/team`)       | Proxy rewrite target for team routes         |
| `academy.eleva.care` | `elevacare-academy` (`apps/academy`) | Proxy rewrite target for academy routes      |
| `email.eleva.care`   | `elevacare-email` (`apps/email`)     | React Email preview tool, internal only      |
| `docs.eleva.care`    | `elevacare-docs` (`apps/docs`)       | Proxy rewrite target for /docs zone          |

**Internal-subdomain canonicalization rule** (ADR-014): every internal subdomain serves either a 301 redirect to the canonical `eleva.care/...` URL **or** `X-Robots-Tag: noindex` + `robots.txt` disallow. Only `eleva.care` and `api.eleva.care` (not indexed, server-only) are publicly addressable.

### Per-PR previews

`*.preview.eleva.care` wildcard alias to Vercel's auto-generated preview URLs. Same multi-zone topology; previews serve the gateway by default and rewrite to preview-scoped sub-app URLs via preview env vars.

## Production URL Matrix

### Human-facing (eleva.care)

| Concern                                           | Production URL                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Marketing home — EN default (unauth)              | `https://eleva.care/`                                                                                 |
| Marketing home — PT                               | `https://eleva.care/pt/`                                                                              |
| Marketing home — ES                               | `https://eleva.care/es/`                                                                              |
| Marketing home — escape hatch for logged-in users | `https://eleva.care/home`                                                                             |
| Root with session                                 | `https://eleva.care/` → 302 redirect to role home                                                     |
| Public expert profile                             | `https://eleva.care/patimota`                                                                         |
| Public clinic profile                             | `https://eleva.care/clinicnameXYZ` (shared root namespace with experts — ADR-014, identity-rbac-spec) |
| Booking funnel (event-specific)                   | `https://eleva.care/patimota/first-consultation`                                                      |
| Category landing                                  | `https://eleva.care/experts/womens-health`                                                            |
| Become-Partner                                    | `https://eleva.care/become-partner`                                                                   |
| Clinic signup                                     | `https://eleva.care/clinics`                                                                          |
| Member dashboard                                  | `https://eleva.care/[orgSlug]` (proxy → `elevacare-app`)                                              |
| Expert dashboard                                  | `https://eleva.care/[orgSlug]/expert` (proxy → `elevacare-expert`)                                    |
| Team management                                   | `https://eleva.care/[orgSlug]/team` (proxy → `elevacare-team`)                                        |
| Academy (lecturer)                                | `https://eleva.care/[orgSlug]/academy` (proxy → `elevacare-academy`)                                  |
| Sign in                                           | `https://eleva.care/signin` (proxy → `elevacare-account`)                                             |
| Account / settings                                | `https://eleva.care/account` (proxy → `elevacare-account`)                                            |
| Onboarding                                        | `https://eleva.care/onboarding` (proxy → `elevacare-account`)                                         |
| Admin ops                                         | `https://admin.eleva.care/` (subdomain)                                                               |
| WorkOS AuthKit callback                           | `https://eleva.care/callback` (proxy → `elevacare-account`)                                           |
| Logout                                            | `https://eleva.care/logout` (proxy → `elevacare-account`)                                             |
| Docs + ERS PT compliance                          | `https://eleva.care/docs/compliance/portugal`                                                         |

Locale prefixing uses next-intl `localePrefix: 'as-needed'`: EN serves at the root (no prefix); PT and ES carry the `pt` / `es` prefix.

### Server-facing (api.eleva.care)

| Concern                                                   | Production URL                                             |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| Stripe webhook (external)                                 | `https://api.eleva.care/webhooks/stripe`                   |
| Stripe AccountSession (session-aware, CORS + credentials) | `https://api.eleva.care/stripe/account-session`            |
| Daily transcript webhook                                  | `https://api.eleva.care/daily/transcripts`                 |
| Daily room events webhook                                 | `https://api.eleva.care/daily/events`                      |
| Resend delivery-events webhook                            | `https://api.eleva.care/resend/events`                     |
| WorkOS events webhook                                     | `https://api.eleva.care/workos/webhook`                    |
| Calendar OAuth callback (Google)                          | `https://api.eleva.care/calendar/oauth/google/callback`    |
| Calendar OAuth callback (Microsoft)                       | `https://api.eleva.care/calendar/oauth/microsoft/callback` |
| TOConline OAuth callback (Tier 1 + expert-side)           | `https://api.eleva.care/accounting/toconline/callback`     |
| Moloni OAuth callback                                     | `https://api.eleva.care/accounting/moloni/callback`        |
| Per-adapter Tier 2 accounting callbacks                   | `https://api.eleva.care/accounting/[adapter]/callback`     |
| Health check                                              | `https://api.eleva.care/health`                            |

### Third-party-hosted

| Concern                   | Production URL                    |
| ------------------------- | --------------------------------- |
| Status page (BetterStack) | `https://status.eleva.care/`      |
| Sessions (Daily branded)  | `https://sessions.eleva.care/...` |

## Staging URL Matrix

- `staging.eleva.care` — gateway staging (rewrites to staging `elevacare-app` for `/patient`, `/expert`, `/org`, `/admin`, `/settings`, `/callback`, `/logout`; rewrites `/docs/*` to staging `elevacare-docs`)
- `api.staging.eleva.care` — staging `elevacare-api` Vercel project (separate subdomain, not rewritten)

Per-PR previews: `*.preview.eleva.care` wildcard. Preview env vars in the gateway project point `APP_URL`, `DOCS_URL` at the matching preview deployment URLs of sibling apps; API preview URL points at the preview `elevacare-api` deployment.

## Required DNS Records (Vercel-Managed)

### Root domain

- `A` / `AAAA` → Vercel edge (auto-managed)
- `CAA` → Let's Encrypt + Vercel CAs

### Email (Resend — required for deliverability)

Set up in Vercel DNS when Resend domain is added:

- `TXT @` → SPF record (Resend sender IPs)
- `TXT resend._domainkey` → DKIM (Resend provides exact value)
- `TXT _dmarc` → DMARC policy starting at `p=quarantine` → hardening to `p=reject` post-launch
- `TXT _bimi` → BIMI record pointing at [brand-book/assets/social/eleva-care-bimi-logo.svg](./brand-book/assets/social/eleva-care-bimi-logo.svg); requires VMC (Verified Mark Certificate) for Gmail/Apple Mail brand display
- `MX` → Resend inbound (only if we add Lane 1 inbound email handling later; not at launch)

### Subdomain apps

- `CNAME admin` → `elevacare-admin` Vercel project (`admin.eleva.care`)
- `CNAME api` → `elevacare-api` Vercel project (`api.eleva.care`)
- `CNAME app` → `elevacare-app` Vercel project (`app.eleva.care`, proxy target)
- `CNAME account` → `elevacare-account` Vercel project (`account.eleva.care`, proxy target)
- `CNAME expert` → `elevacare-expert` Vercel project (`expert.eleva.care`, proxy target)
- `CNAME team` → `elevacare-team` Vercel project (`team.eleva.care`, proxy target)
- `CNAME academy` → `elevacare-academy` Vercel project (`academy.eleva.care`, proxy target)
- `CNAME docs` → `elevacare-docs` Vercel project (`docs.eleva.care`, proxy target)
- `CNAME email` → `elevacare-email` (internal only)
- `CNAME sessions` → Daily.co branded video
- `CNAME status` → BetterStack status page

## Environment-Specific Configuration

### Local dev specifics

Apps run via `pnpm dev` through Turborepo; `.env.local` in the monorepo root populates shared env vars.

**Port assignments:**

| App           | Port | Env var                |
| ------------- | ---- | ---------------------- |
| web (gateway) | 3000 | --                     |
| app (member)  | 3001 | `APP_ASSET_PREFIX`     |
| api           | 3002 | --                     |
| expert        | 3003 | `EXPERT_ASSET_PREFIX`  |
| team          | 3004 | `TEAM_ASSET_PREFIX`    |
| academy       | 3005 | `ACADEMY_ASSET_PREFIX` |
| account       | 3006 | `ACCOUNT_URL`          |
| admin         | 3007 | `ADMIN_URL`            |
| docs          | 3008 | `DOCS_URL`             |
| email         | 3009 | --                     |

- Gateway's asset prefix env vars point at sibling ports so proxy rewrites resolve locally.
- API is **not** rewritten; apps call `localhost:3002` directly.
- Stripe webhooks forwarded via `stripe listen --forward-to localhost:3002/webhooks/stripe`.
- Daily rooms use the test domain; transcripts use the dev webhook URL (local tunnel when external reachability is needed).
- WorkOS redirect URI: `http://localhost:3000/callback` (gateway proxies to account app).
- Calendar OAuth + TOConline OAuth callbacks point at `localhost:3002` (api zone).

### Staging specifics

- `staging.eleva.care` is the staging gateway; app routes (`/patient`, `/expert`, `/org`, `/admin`, `/settings`, `/callback`, `/logout`) rewritten from gateway to staging app zone; docs at `/docs/*`; API on `api.staging.eleva.care` subdomain (separate project).
- **Stripe staging account** (separate from production) with test payment methods + MB WAY test mode.
- WorkOS staging project (separate tenant).
- Neon staging branch of `eleva_v3_main` + `eleva_v3_audit`.
- Daily staging domain.
- Resend staging sender domain (`staging.eleva.care` DKIM).
- Sentry `eleva-v3-staging` project.
- BetterStack staging collector.
- Production-like data volumes via synthetic seeds; no real PHI.

### Production specifics

- `eleva.care` is the canonical human-facing domain; authenticated routes at the top level (no `/app` prefix); docs under `/docs/*` via multi-zone rewrite.
- `api.eleva.care` is the dedicated server-facing API subdomain; not rewritten from the gateway.
- Internal Vercel project URLs serve `noindex` or 301-redirect to canonical.
- **Stripe production account**, separate webhook, Connect, and seed scripts.
- WorkOS production project (EU).
- Neon `eleva_v3_main` + `eleva_v3_audit` production (EU region).
- Daily production (EU).
- Resend production sender domain (`eleva.care` DKIM, DMARC, BIMI).
- Twilio EU subaccount.
- Sentry `eleva-v3-production` project.
- BetterStack production log drain + public status page on `status.eleva.care`.
- Edge Config kill-switches per-tier.

## Integration → Environment Callback Mapping

Webhooks, OAuth callbacks, and session-aware APIs live on the `api.eleva.care` subdomain in production and `api.staging.eleva.care` in staging. WorkOS AuthKit callback lives at `eleva.care/callback` (rewritten from gateway to app zone) because it's part of the human-facing auth flow. In local dev the gateway runs on `localhost:3000`, the app on `:3001`, the api on `:3002`; Stripe CLI forwards webhooks.

| Integration                                 | Local                                                | Staging                                                    | Production                                         |
| ------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| Stripe webhook                              | `localhost:3002/webhooks/stripe` via `stripe listen` | `api.staging.eleva.care/webhooks/stripe`                   | `api.eleva.care/webhooks/stripe`                   |
| Stripe AccountSession (session-aware, CORS) | `localhost:3002/stripe/account-session`              | `api.staging.eleva.care/stripe/account-session`            | `api.eleva.care/stripe/account-session`            |
| WorkOS AuthKit callback (human-facing)      | `localhost:3000/callback` (gateway → account app)    | `staging.eleva.care/callback`                              | `eleva.care/callback`                              |
| WorkOS events webhook (server-to-server)    | `localhost:3002/workos/webhook`                      | `api.staging.eleva.care/workos/webhook`                    | `api.eleva.care/workos/webhook`                    |
| Google Calendar OAuth                       | `localhost:3002/calendar/oauth/google/callback`      | `api.staging.eleva.care/calendar/oauth/google/callback`    | `api.eleva.care/calendar/oauth/google/callback`    |
| Microsoft Calendar OAuth                    | `localhost:3002/calendar/oauth/microsoft/callback`   | `api.staging.eleva.care/calendar/oauth/microsoft/callback` | `api.eleva.care/calendar/oauth/microsoft/callback` |
| TOConline OAuth                             | `localhost:3002/accounting/toconline/callback`       | `api.staging.eleva.care/accounting/toconline/callback`     | `api.eleva.care/accounting/toconline/callback`     |
| Daily transcript webhook                    | local tunnel (ngrok) when needed                     | `api.staging.eleva.care/daily/transcripts`                 | `api.eleva.care/daily/transcripts`                 |
| Resend delivery events                      | local tunnel                                         | `api.staging.eleva.care/resend/events`                     | `api.eleva.care/resend/events`                     |

## Secret Loading Mechanics

- Never share secrets across environments. Each has its own Vercel project with its own env var set.
- `vercel env pull .env.local` is the only approved way to populate local dev secrets; never check secrets into the repo.
- Vercel Marketplace integrations (Neon, Upstash, Resend, Sentry, BetterStack) populate env vars automatically when linked.
- WorkOS Vault holds OAuth tokens (Google, Microsoft, TOConline, Moloni, etc.) — not env vars.

## Preview Environments — Integration Posture

| Integration | Posture in preview                                            |
| ----------- | ------------------------------------------------------------- |
| Stripe      | test mode, staging keys                                       |
| WorkOS      | staging tenant                                                |
| Neon        | ephemeral branch per PR                                       |
| Daily       | test domain                                                   |
| Resend      | test key; emails blackholed to internal tester addresses      |
| Twilio      | disabled; SMS no-ops with log                                 |
| TOConline   | sandbox only; manual invoicing flow                           |
| Sentry      | preview-tagged events in `eleva-v3-staging` project           |
| BetterStack | preview log drain (separate source)                           |
| PostHog     | preview-tagged events; ff evaluation uses Edge Config staging |
| GA4         | disabled                                                      |

## Related Docs

- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`monorepo-structure.md`](./monorepo-structure.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
- [`implementation-sprints.md`](./implementation-sprints.md)
