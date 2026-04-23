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

## Public Surface — Single Canonical Domain (Multi-Zone, ADR-014)

The public surface is **one domain**: `eleva.care`. Multiple Vercel projects serve different path prefixes via **multi-zone rewrites** behind a gateway app.

### Zone map

| App | Vercel project | basePath | Public URL shape |
| --- | -------------- | -------- | ---------------- |
| Gateway (marketing + marketplace + public profiles + booking funnel) | `elevacare-marketing` (`apps/web`) | `/` | `eleva.care/`, `eleva.care/[username]`, `eleva.care/[username]/[event-slug]` |
| Authenticated product | `elevacare-app` (`apps/app`) | `/app` | `eleva.care/app/patient`, `/app/expert`, `/app/org`, `/app/admin`, `/app/api/*` (session-aware APIs) |
| External-facing API + webhooks + OAuth callbacks | `elevacare-api` (`apps/api`) | `/api` | `eleva.care/api/stripe/webhook`, `/api/daily/*`, `/api/calendar/*`, `/api/accounting/*` |
| Product + ERS PT docs | `elevacare-docs` (`apps/docs`) | `/docs` | `eleva.care/docs/*` |

Rewrites are declared in `apps/web/next.config.mjs` (gateway) and resolved `afterFiles`. Each sub-app sets its matching `basePath` in its own `next.config.mjs`.

### Third-party-hosted surfaces (still subdomains)

Some surfaces are not Vercel-hosted and cannot be path-rewritten:

| Subdomain | Host | Purpose |
| --------- | ---- | ------- |
| `status.eleva.care` | BetterStack | public status page, uptime + incident communication |
| `sessions.eleva.care` | Daily.co (CNAME) | branded video session URLs |

### Internal-only subdomains

These exist for operational purposes but are **never shared with users**:

| Subdomain | Host | Purpose |
| --------- | ---- | ------- |
| `email.eleva.care` | `elevacare-email` (`apps/email`) | React Email preview tool, internal only |
| `elevacare-app.vercel.app`, `elevacare-api.vercel.app`, `elevacare-docs.vercel.app` | Vercel project domains | CI, preview deploys, rewrite targets |

**Internal-subdomain canonicalization rule** (ADR-014): every internal subdomain serves either a 301 redirect to the canonical `eleva.care/...` URL **or** `X-Robots-Tag: noindex` + `robots.txt` disallow. Only `eleva.care` appears in search engines.

### Per-PR previews

`*.preview.eleva.care` wildcard alias to Vercel's auto-generated preview URLs. Same multi-zone topology; previews serve the gateway by default and rewrite to preview-scoped sub-app URLs via preview env vars.

## Production URL Matrix

| Concern | Production URL |
| ------- | -------------- |
| Marketing home (EN default) | `https://eleva.care/` |
| Marketing home PT | `https://eleva.care/pt/` |
| Marketing home ES | `https://eleva.care/es/` |
| Public expert profile | `https://eleva.care/patimota` |
| Public clinic profile | `https://eleva.care/clinicnameXYZ` (shared root namespace with experts — ADR-014, identity-rbac-spec) |
| Booking funnel (event-specific) | `https://eleva.care/patimota/first-consultation` |
| Category landing | `https://eleva.care/experts/womens-health` |
| Become-Partner | `https://eleva.care/become-partner` |
| Clinic signup | `https://eleva.care/clinics` |
| Authenticated patient | `https://eleva.care/app/patient` |
| Authenticated expert | `https://eleva.care/app/expert` |
| Authenticated clinic admin | `https://eleva.care/app/org` |
| Eleva operator | `https://eleva.care/app/admin` |
| Stripe AccountSession (session-aware, app zone) | `https://eleva.care/app/api/stripe/account-session` |
| Stripe webhook (external, api zone) | `https://eleva.care/api/stripe/webhook` |
| Daily transcript webhook | `https://eleva.care/api/daily/transcripts` |
| Resend delivery-events webhook | `https://eleva.care/api/resend/events` |
| WorkOS AuthKit callback | `https://eleva.care/callback` (gateway-handled, proxy forwards to app zone) |
| Calendar OAuth callback (Google / Microsoft) | `https://eleva.care/api/calendar/oauth/[provider]/callback` |
| TOConline OAuth callback | `https://eleva.care/api/accounting/toconline/callback` |
| Per-adapter Tier 2 accounting callbacks | `https://eleva.care/api/accounting/[adapter]/callback` |
| Docs + ERS PT compliance | `https://eleva.care/docs/compliance/portugal` |
| Status page (subdomain, external host) | `https://status.eleva.care/` |
| Sessions (branded Daily) | `https://sessions.eleva.care/...` |

Locale prefixing uses next-intl `localePrefix: 'as-needed'`: EN serves at the root (no prefix); PT and ES carry the `pt` / `es` prefix.

## Staging URL Matrix

Same shape, subdomain-prefixed with `staging-`:

- `staging.eleva.care` (gateway staging)
- `staging.eleva.care/app/*` → staging `elevacare-app` Vercel project
- `staging.eleva.care/api/*` → staging `elevacare-api` Vercel project
- `staging.eleva.care/docs/*` → staging `elevacare-docs` Vercel project

Per-PR previews: `*.preview.eleva.care` wildcard. Preview env vars in the gateway project point `APP_URL`, `API_URL`, `DOCS_URL` at the matching preview deployment URLs of sibling apps.

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

- `CNAME app`, `api`, `docs`, `email`, `sessions`, `status` → their respective Vercel projects / Daily / BetterStack

## Environment-Specific Configuration

### Local dev specifics

- Apps run via `pnpm dev` through Turborepo; `vercel env pull .env.local` populates env vars from the Vercel Marketplace integrations (Neon branch, Upstash sandbox, Resend test, Sentry dev project, etc.) per app.
- Gateway runs on `localhost:3000`, app zone on `localhost:3001`, api zone on `localhost:3002`, docs zone on `localhost:3003`.
- Gateway's `APP_URL`, `API_URL`, `DOCS_URL` env vars point at the sibling ports so rewrites resolve locally.
- Stripe webhooks forwarded via `stripe listen --forward-to localhost:3002/api/stripe/webhook`.
- Daily rooms use the test domain; transcripts use the dev webhook URL (local tunnel when external reachability is needed).
- WorkOS app configured with `http://localhost:3000/callback`.
- Calendar OAuth callbacks point at `localhost:3002`.

### Staging specifics

- `staging.eleva.care` is the staging gateway; app/api/docs zones served under `/app`, `/api`, `/docs` prefixes via multi-zone rewrites (same pattern as production).
- **Stripe staging account** (separate from production) with test payment methods + MB WAY test mode.
- WorkOS staging project (separate tenant).
- Neon staging branch of `eleva_v3_main` + `eleva_v3_audit`.
- Daily staging domain.
- Resend staging sender domain (`staging.eleva.care` DKIM).
- Sentry `eleva-v3-staging` project.
- BetterStack staging collector.
- Production-like data volumes via synthetic seeds; no real PHI.

### Production specifics

- `eleva.care` is the single canonical public domain; app/api/docs served under `/app`, `/api`, `/docs` prefixes via multi-zone rewrites.
- Internal Vercel project URLs serve `noindex` or 301-redirect to the canonical path.
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

All callbacks resolve under the canonical `eleva.care` domain in production and `staging.eleva.care` in staging. In local dev the gateway runs on `localhost:3000` and the api zone on `localhost:3002`; Stripe CLI forwards webhooks.

| Integration | Local | Staging | Production |
| ----------- | ----- | ------- | ---------- |
| Stripe webhook | `localhost:3002/api/stripe/webhook` via `stripe listen` | `staging.eleva.care/api/stripe/webhook` | `eleva.care/api/stripe/webhook` |
| Stripe AccountSession (session-aware) | `localhost:3001/app/api/stripe/account-session` | `staging.eleva.care/app/api/stripe/account-session` | `eleva.care/app/api/stripe/account-session` |
| WorkOS AuthKit callback | `localhost:3000/callback` | `staging.eleva.care/callback` | `eleva.care/callback` |
| Google Calendar OAuth | `localhost:3002/api/calendar/oauth/google/callback` | `staging.eleva.care/api/calendar/oauth/google/callback` | `eleva.care/api/calendar/oauth/google/callback` |
| Microsoft Calendar OAuth | `localhost:3002/api/calendar/oauth/microsoft/callback` | `staging.eleva.care/api/calendar/oauth/microsoft/callback` | `eleva.care/api/calendar/oauth/microsoft/callback` |
| TOConline OAuth | `localhost:3002/api/accounting/toconline/callback` | `staging.eleva.care/api/accounting/toconline/callback` | `eleva.care/api/accounting/toconline/callback` |
| Daily transcript webhook | local tunnel (ngrok) when needed | `staging.eleva.care/api/daily/transcripts` | `eleva.care/api/daily/transcripts` |
| Resend delivery events | local tunnel | `staging.eleva.care/api/resend/events` | `eleva.care/api/resend/events` |

## Secret Loading Mechanics

- Never share secrets across environments. Each has its own Vercel project with its own env var set.
- `vercel env pull .env.local` is the only approved way to populate local dev secrets; never check secrets into the repo.
- Vercel Marketplace integrations (Neon, Upstash, Resend, Sentry, BetterStack) populate env vars automatically when linked.
- WorkOS Vault holds OAuth tokens (Google, Microsoft, TOConline, Moloni, etc.) — not env vars.

## Preview Environments — Integration Posture

|Integration|Posture in preview|
|---|---|
|Stripe|test mode, staging keys|
|WorkOS|staging tenant|
|Neon|ephemeral branch per PR|
|Daily|test domain|
|Resend|test key; emails blackholed to internal tester addresses|
|Twilio|disabled; SMS no-ops with log|
|TOConline|sandbox only; manual invoicing flow|
|Sentry|preview-tagged events in `eleva-v3-staging` project|
|BetterStack|preview log drain (separate source)|
|PostHog|preview-tagged events; ff evaluation uses Edge Config staging|
|GA4|disabled|

## Related Docs

- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`monorepo-structure.md`](./monorepo-structure.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
- [`implementation-sprints.md`](./implementation-sprints.md)
