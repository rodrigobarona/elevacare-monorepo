# Eleva.care Monorepo

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/rodrigobarona/elevacare-monorepo?utm_source=oss&utm_medium=github&utm_campaign=rodrigobarona%2Felevacare-monorepo&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

Eleva.care v3: a Portugal-first, EU-first health and wellness marketplace and community. Members
book sessions with independent, licensed experts; clinics (Teams) run several experts under one
organization; Academy is the education surface. Built as a pnpm + Turborepo monorepo on Next.js 16,
React 19 and Tailwind v4.

- Architecture handbook, specs and ADRs: [`docs/eleva-v3/`](docs/eleva-v3/README.md)
- Phased delivery plan and current status: [`docs/eleva-v3/execution-plan/`](docs/eleva-v3/execution-plan/README.md)
- Agent and contributor rules: [`AGENTS.md`](AGENTS.md)

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9.15.0 (enforced — `npm` and `yarn` are blocked at install time)

## Getting started

```bash
pnpm install
pnpm dev        # starts all apps in parallel via Turborepo
```

End users only ever see `eleva.care` (production) or `dev.eleva.care` (staging). User-facing apps
are mounted on the root domain through gateway rewrites in `apps/web`; `api`, `account` and `admin`
use real subdomains. See `docs/eleva-v3/environment-matrix.md`.

## Apps (`apps/`)

| Directory      | Package                | Port | Purpose                                                                               |
| -------------- | ---------------------- | ---- | ------------------------------------------------------------------------------------- |
| `apps/web`     | `@eleva/web`           | 3000 | Public marketing site, expert profiles, booking funnel, and the `eleva.care` gateway  |
| `apps/app`     | `@eleva/app`           | 3001 | Member app: sessions, join video (`/join/{bookingId}`), payments, reports, privacy    |
| `apps/api`     | `@eleva/api`           | 3002 | `api.eleva.care`: Better Auth (`/auth/*`), REST + OpenAPI, webhooks, QStash workflows |
| `apps/expert`  | `@eleva/expert`        | 3003 | Expert app: setup, services, schedules, calendars, sessions, records, CRM, finance    |
| `apps/team`    | `@eleva/team`          | 3004 | Clinic (Team) admin app — shell today, built in Phase 11                              |
| `apps/academy` | `@eleva/academy-app`   | 3005 | Academy — placeholder until the Academy phase                                         |
| `apps/account` | `@eleva/account`       | 3006 | Account hub: sign in/up, 2FA, passkeys, settings, Spaces and workspace creation       |
| `apps/admin`   | `@eleva/admin`         | 3007 | Staff console (`admin.eleva.care`) — shell today, built in Phase 12                   |
| `apps/docs`    | `@eleva/docs`          | 3008 | Help center at `/docs` (members, experts, clinics) on headless Fumadocs               |
| `apps/email`   | `@eleva/email-preview` | 3009 | Internal React Email template preview                                                 |
| `apps/poc`     | `@eleva/poc`           | 3099 | Internal design playground (excluded from CI, lint and review)                        |

All HTTP route handlers live in `apps/api`. Frontend apps use Server Actions as thin, Zod-validated
proxies to `@eleva/api-client` or domain packages.

## Packages (`packages/`)

### Platform and data

| Package                | Purpose                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `@eleva/db`            | Drizzle ORM + Neon: schema, RLS, migrations, query helpers, seeds         |
| `@eleva/auth`          | Better Auth server/client/proxy, permissions SSOT, provisioning (ADR-017) |
| `@eleva/audit`         | Transactional audit outbox (`withAudit`) and drainer                      |
| `@eleva/encryption`    | Envelope encryption, per-org keys, KEK rotation (ADR-020)                 |
| `@eleva/storage`       | The only object storage access (R2 public and private buckets)            |
| `@eleva/config`        | Env validation, locales, routing, shared constants                        |
| `@eleva/flags`         | Feature flags (Vercel Flags + Edge Config)                                |
| `@eleva/observability` | Sentry with PHI redaction, security headers, CSP, heartbeats              |
| `@eleva/workflows`     | Domain events and QStash-driven workflow logic                            |
| `@eleva/api-client`    | Typed HTTP client and request/response schemas for `apps/api`             |

### Domain

| Package                | Purpose                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `@eleva/scheduling`    | Offers, availability, reservations, booking lifecycle, cancellation refunds |
| `@eleva/calendar`      | External calendar busy-time and destination sync                            |
| `@eleva/billing`       | Stripe payments, Connect payouts, subscriptions, webhook dispatcher         |
| `@eleva/accounting`    | TOConline invoicing (issuance gate closed until AT Comunicação is wired)    |
| `@eleva/notifications` | Email (Resend), SMS (Twilio) and in-app inbox                               |
| `@eleva/video`         | Daily rooms, meeting tokens, join UI (standard Daily, not HIPAA)            |
| `@eleva/records`       | Encrypted session records, documents, templates, AI report drafts           |
| `@eleva/crm`           | Expert relationships and follow-ups                                         |
| `@eleva/compliance`    | Consents, DSAR export, account deletion, retention sweeps                   |
| `@eleva/ai`            | Vercel AI Gateway (EU, zero-retention guard) for drafts and translation     |
| `@eleva/integrations`  | Integration registry and manifests                                          |
| `@eleva/academy`       | Placeholder for the Academy domain                                          |

### UI and content

| Package                    | Purpose                                                         |
| -------------------------- | --------------------------------------------------------------- |
| `@eleva/ui`                | React Aria Components (shadcn `aria-luma`), brand tokens, fonts |
| `@eleva/icons`             | Phosphor icon SSOT                                              |
| `@eleva/dashboard`         | Shared authenticated app shell, nav, theme and locale providers |
| `@eleva/site-chrome`       | Public header, mega menu, mobile nav and footer                 |
| `@eleva/editor`            | Plate rich-text editor (ADR-023)                                |
| `@eleva/email`             | Branded React Email templates                                   |
| `@eleva/content`           | Legal, trust and help MDX (en/pt/es) with loaders               |
| `@eleva/media`             | Curated marketing media library                                 |
| `@eleva/consent`           | Cookie consent (c15t on Inth)                                   |
| `@eleva/eslint-config`     | Shared ESLint presets, including vendor-boundary rules          |
| `@eleva/typescript-config` | Shared TypeScript configs                                       |

## Infrastructure (`infra/`)

| Directory      | Purpose                                                   |
| -------------- | --------------------------------------------------------- |
| `infra/stripe` | Products, entitlements, webhooks, portal, payment methods |
| `infra/qstash` | QStash schedule provisioning                              |
| `infra/flags`  | Feature flag definitions per environment                  |

## Scripts

Run from the repo root. The full catalog is in `docs/eleva-v3/operator-tasks/scripts-catalog.md`.

| Script                                       | Description                                         |
| -------------------------------------------- | --------------------------------------------------- |
| `pnpm dev`                                   | Start all apps in development (Turbopack)           |
| `pnpm build`                                 | Production build                                    |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Lint, type-check and Vitest across the workspace    |
| `pnpm check:route-guards`                    | Every API route declares and enforces its policy    |
| `pnpm check:api-first-actions`               | No DB write helpers in frontend Server Actions      |
| `pnpm check:no-phi-logs`                     | No decrypted PHI outside the domain packages        |
| `pnpm check:i18n-parity`                     | `en`/`pt`/`es` message parity                       |
| `pnpm e2e` / `pnpm e2e:*`                    | Playwright suites (live money and video are opt-in) |
| `pnpm review` / `pnpm review:branch`         | CodeRabbit CLI review of local changes / branch     |
| `pnpm db:seed:demo`                          | Seed demo data                                      |

## Adding UI components

Primitives are built on [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html) (shadcn `aria-luma` style — see `.cursor/rules/react-aria-ui.mdc`). Add or regenerate components from `packages/ui`:

```bash
cd packages/ui
pnpm exec shadcn add --overwrite button
```

Afterwards rewrite generated imports to `@eleva/ui/lib/utils` (`cn`) and `@eleva/icons` (icons).
