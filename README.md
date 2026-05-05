# Eleva.care Monorepo

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/rodrigobarona/elevacare-monorepo?utm_source=oss&utm_medium=github&utm_campaign=rodrigobarona%2Felevacare-monorepo&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

Portugal-first health and wellness marketplace connecting patients with certified experts. Built as a pnpm + Turborepo monorepo on Next.js 16, React 19, and Tailwind v4.

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9.15.0 (enforced — `npm` and `yarn` are blocked at install time)

## Getting started

```bash
pnpm install
pnpm dev        # starts all apps in parallel via Turborepo
```

## Monorepo structure

### Apps (`apps/`)

| Directory    | Package        | Port | Purpose                                                                                               |
| ------------ | -------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `apps/web`   | `web`          | 3000 | Marketing gateway and public site — multi-zone rewrites proxy authenticated paths to `app` and `docs` |
| `apps/app`   | `@eleva/app`   | 3001 | Authenticated product shell (patient, expert, org, admin)                                             |
| `apps/api`   | `@eleva/api`   | 3002 | Backend API surface (`api.eleva.care`)                                                                |
| `apps/docs`  | `@eleva/docs`  | 3003 | Public documentation (mounted at `/docs`)                                                             |
| `apps/email` | `@eleva/email` | 3004 | Internal React Email template preview                                                                 |

### Packages (`packages/`)

#### Core infrastructure

| Package                | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `@eleva/db`            | Drizzle ORM + Neon — schema, RLS, migrations, seed scripts   |
| `@eleva/auth`          | WorkOS AuthKit Next.js integration                           |
| `@eleva/config`        | Shared env validation (Zod), i18n config, reserved usernames |
| `@eleva/encryption`    | Encryption helpers (WorkOS Vault)                            |
| `@eleva/observability` | Sentry integration and proxy/CSP entrypoints                 |
| `@eleva/flags`         | Feature flags via Vercel Flags + Edge Config                 |
| `@eleva/workflows`     | Durable workflow logic over `@eleva/db`                      |

#### Domain packages

| Package                | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `@eleva/billing`       | Stripe Connect, embedded components, Vercel Blob uploads |
| `@eleva/accounting`    | TOConline/Moloni adapters, invoicing registry            |
| `@eleva/scheduling`    | Scheduling domain                                        |
| `@eleva/calendar`      | Calendar domain                                          |
| `@eleva/compliance`    | Compliance domain                                        |
| `@eleva/crm`           | CRM domain                                               |
| `@eleva/notifications` | Notifications domain                                     |
| `@eleva/audit`         | Audit logging                                            |
| `@eleva/ai`            | AI module                                                |

#### Shared UI and tooling

| Package                    | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `@eleva/ui`                | shadcn/Radix component library, hooks, and `globals.css`                  |
| `@eleva/eslint-config`     | Shared ESLint presets (`base`, `next-js`, `react-internal`, `boundaries`) |
| `@eleva/typescript-config` | Shared TypeScript configs                                                 |

### Infrastructure (`infra/`)

| Package               | Purpose                                 |
| --------------------- | --------------------------------------- |
| `@eleva/infra-workos` | RBAC role/permission generation scripts |

## Scripts

Run from the repo root — Turborepo handles cross-package orchestration.

| Script               | Description                                  |
| -------------------- | -------------------------------------------- |
| `pnpm dev`           | Start all apps in development (Turbopack)    |
| `pnpm build`         | Production build                             |
| `pnpm lint`          | Lint all packages                            |
| `pnpm format`        | Format with Prettier                         |
| `pnpm typecheck`     | TypeScript type checking                     |
| `pnpm test`          | Run Vitest test suites                       |
| `pnpm db:seed:demo`  | Seed the database with demo data             |
| `pnpm rbac:generate` | Generate WorkOS RBAC roles/permissions       |
| `pnpm flags:sync`    | Sync feature flag definitions to Edge Config |

## Adding UI components

Add shadcn components from the repo root:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Components are placed in `packages/ui/src/components` and imported as:

```tsx
import { Button } from "@eleva/ui/components/button"
```

## Documentation

The v3 architecture handbook, specs, and decision records live in [`docs/eleva-v3/`](docs/eleva-v3/README.md). ADRs are tracked in [`docs/eleva-v3/adrs/`](docs/eleva-v3/adrs/README.md).
