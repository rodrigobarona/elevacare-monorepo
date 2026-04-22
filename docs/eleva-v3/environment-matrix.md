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
- Wildcard SSL covers `*.eleva.care` for app subdomains plus per-PR preview subdomains.

## Subdomain Map (Locked)

| Subdomain               | Points to                              | Purpose                                                                         |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| `eleva.care`            | `apps/web` (`elevacare-marketing`)     | marketing, marketplace, public expert profiles, Become-Partner, clinic signup   |
| `app.eleva.care`        | `apps/app` (`elevacare-app`)           | authenticated product (patient, expert, clinic, operator workspaces)            |
| `api.eleva.care`        | `apps/api` (`elevacare-api`)           | webhooks (Stripe, Daily, Resend), `/api/stripe/account-session`, server ops API |
| `docs.eleva.care`       | `apps/docs` (`elevacare-docs`)         | Fumadocs product + ERS PT compliance docs                                       |
| `email.eleva.care`      | `apps/email` (`elevacare-email`)       | React Email preview tooling; internal only                                      |
| `status.eleva.care`     | BetterStack public status page         | uptime + incident communication                                                 |
| `sessions.eleva.care`   | Daily.co branded subdomain (CNAME)     | branded video session URLs; enables Daily's custom domain feature               |
| `*.preview.eleva.care`  | Vercel preview deployments (wildcard)  | per-PR preview URLs with SSL                                                    |

## Production URL Matrix

|Concern|Production URL|
|---|---|
|Marketing + marketplace root|`https://eleva.care/`|
|Public expert profile|`https://eleva.care/[locale]/e/[username]`|
|Booking funnel|`https://eleva.care/[locale]/e/[username]/[event]`|
|Authenticated patient|`https://app.eleva.care/[locale]/patient`|
|Authenticated expert|`https://app.eleva.care/[locale]/expert`|
|Authenticated clinic admin|`https://app.eleva.care/[locale]/org`|
|Eleva operator|`https://app.eleva.care/[locale]/admin`|
|Stripe webhook|`https://api.eleva.care/api/stripe/webhook`|
|Daily transcript webhook|`https://api.eleva.care/api/daily/transcripts`|
|Resend inbound / delivery events webhook|`https://api.eleva.care/api/resend/events`|
|WorkOS authkit callback|`https://app.eleva.care/callback` (plus marketing variant on `eleva.care/callback` if needed)|
|Calendar OAuth callback (Google / Microsoft)|`https://api.eleva.care/api/calendar/oauth/[provider]/callback`|
|TOConline OAuth callback|`https://api.eleva.care/api/accounting/toconline/callback`|
|Per-expert Tier 2 adapter callbacks|`https://api.eleva.care/api/accounting/[adapter]/callback`|
|Docs|`https://docs.eleva.care/`|
|Status page|`https://status.eleva.care/`|

## Staging URL Matrix

Same shape, subdomain-prefixed with `staging-`:

- `staging.eleva.care`
- `staging-app.eleva.care`
- `staging-api.eleva.care`
- `staging-docs.eleva.care`

Per-PR previews use Vercel's auto-generated `*.vercel.app` URLs, optionally aliased to `*.preview.eleva.care` via wildcard.

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

- Apps run via `pnpm dev` through Turborepo; `vercel env pull .env.local` populates env vars from the Vercel Marketplace integrations (Neon branch, Upstash sandbox, Resend test, Sentry dev project, etc.)
- Stripe webhooks forwarded via `stripe listen` to `http://localhost:3001/api/stripe/webhook`
- Daily rooms use the test domain; transcripts use dev webhook
- WorkOS app configured with `http://localhost:3000` / `http://localhost:3001` callbacks
- Calendar OAuth callbacks point at `localhost`

### Staging specifics

- `staging-app.eleva.care`, `staging-api.eleva.care`, etc.
- **Stripe staging account** (separate from production) with test payment methods + MB WAY test mode
- WorkOS staging project (separate tenant)
- Neon staging branch of `eleva_v3_main` + `eleva_v3_audit`
- Daily staging domain
- Resend staging sender domain (`staging.eleva.care` DKIM)
- Sentry `eleva-v3-staging` project
- BetterStack staging collector
- Production-like data volumes via synthetic seeds; no real PHI

### Production specifics

- `eleva.care`, `app.eleva.care`, `api.eleva.care`, etc.
- **Stripe production account**, separate webhook, Connect, and seed scripts
- WorkOS production project (EU)
- Neon `eleva_v3_main` + `eleva_v3_audit` production (EU region)
- Daily production (EU)
- Resend production sender domain (`eleva.care` DKIM, DMARC, BIMI)
- Twilio EU subaccount
- Sentry `eleva-v3-production` project
- BetterStack production log drain + status page
- Edge Config kill-switches per-tier

## Integration → Environment Callback Mapping

|Integration|Local|Staging|Production|
|---|---|---|---|
|Stripe webhook|`localhost:3001` via `stripe listen`|`staging-api.eleva.care/api/stripe/webhook`|`api.eleva.care/api/stripe/webhook`|
|WorkOS callback|`localhost:3000/callback`|`staging-app.eleva.care/callback`|`app.eleva.care/callback`|
|Google Calendar OAuth|`localhost:3001/api/calendar/oauth/google/callback`|`staging-api.eleva.care/api/calendar/oauth/google/callback`|`api.eleva.care/api/calendar/oauth/google/callback`|
|Microsoft Calendar OAuth|same pattern with `/microsoft/`|same|same|
|TOConline OAuth|`localhost:3001/api/accounting/toconline/callback`|`staging-api.eleva.care/...`|`api.eleva.care/...`|
|Daily transcript webhook|local tunnel (ngrok) in rare cases|`staging-api.eleva.care/api/daily/transcripts`|`api.eleva.care/api/daily/transcripts`|
|Resend delivery events|local tunnel|`staging-api.eleva.care/api/resend/events`|`api.eleva.care/api/resend/events`|

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
