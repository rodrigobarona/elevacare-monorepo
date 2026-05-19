# Operator Scripts Catalog

Status: Living. Add new entries here whenever a new `pnpm <script>`
command lands at the root level.

## Purpose

Single index of every operator-runnable script in the monorepo —
what it does, when to run it, what env vars it needs, what's safe to
re-run.

For the architectural rationale (where scripts live and why), see
[`infra/README.md` patterns](#where-scripts-live) at the bottom of
this doc.

## Quick reference (by vendor / domain)

All commands run from the repo root.

### Stripe

| Command                              | What it does                                                                                                                                                                                                              | Idempotent?                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm stripe:setup:webhooks`         | Create or update the `https://api.eleva.care/webhooks/stripe` endpoint with the canonical 20-event list. Pins `api_version` from `STRIPE_API_VERSION`.                                                                    | Yes (delete + recreate the endpoint via Dashboard if `api_version` already drifted; Stripe locks it at creation). |
| `pnpm stripe:setup:portal`           | Create the Stripe Customer Portal configuration used by `POST /billing/portal`; save the printed ID as `STRIPE_BILLING_PORTAL_CONFIGURATION_ID`.                                                                          | Creates a new config; keep the active ID in env.                                                                  |
| `pnpm stripe:seed`                   | Seed all Stripe products + entitlements (`--apply`).                                                                                                                                                                      | Yes — re-running upserts.                                                                                         |
| `pnpm stripe:seed:products`          | Seed Stripe products and prices only.                                                                                                                                                                                     | Yes                                                                                                               |
| `pnpm stripe:seed:entitlements`      | Seed Stripe Entitlements (mirrors `@eleva/flags` plan matrix).                                                                                                                                                            | Yes                                                                                                               |
| `pnpm stripe:verify:entitlements`    | Compare the canonical WorkOS JWT `entitlements` claim with Stripe's diagnostic `activeEntitlements` API for one org/customer.                                                                                             | Yes — read-only.                                                                                                  |
| `pnpm stripe:backfill:org-customers` | Walk WorkOS orgs missing `stripeCustomerId`, create the Stripe customer, and upsert into the local `billing_customers` mirror.                                                                                            | Yes                                                                                                               |
| `pnpm stripe:replay:event evt_…`     | Re-fetch one event from Stripe and re-run `processStripeEvent` against it. Resets the row's status before dispatching. Use to recover from `ignored` (re-process after backfill) or `failed` (real bug fix shipped) rows. | Yes                                                                                                               |

### WorkOS

| Command                     | What it does                                                                                                              | Idempotent? |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `pnpm workos:rbac:generate` | Apply the RBAC config in `infra/workos/rbac-config.json` to the WorkOS environment (creates/updates roles + permissions). | Yes         |

### QStash (Upstash)

QStash is shared across environments; schedules differentiate
themselves by destination URL. Re-run after rotating tokens or
changing API base URLs.

| Command                           | What it does                                                        | Idempotent? |
| --------------------------------- | ------------------------------------------------------------------- | ----------- |
| `pnpm qstash:list`                | Print every schedule + cross-check expected paths.                  | Yes         |
| `pnpm qstash:setup`               | Provision all 3 schedules in one call.                              | Yes         |
| `pnpm qstash:setup:workos-sync`   | (Re)register `/workos/sync` (every 5 min).                          | Yes         |
| `pnpm qstash:setup:audit-drainer` | (Re)register `/workflows/audit-outbox-drainer` (06:00 + 18:00 UTC). | Yes         |
| `pnpm qstash:setup:stripe-stuck`  | (Re)register `/workflows/stripe-stuck-events` (every 10 min).       | Yes         |

All QStash setup commands accept `-- --dry-run` for preview-only mode.

### DB (Drizzle / Neon)

| Command                            | What it does                                                                                                                                                                   | Idempotent?                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `pnpm db:seed:demo`                | Seed the local DB with demo data.                                                                                                                                              | No (seeds new rows each run; intended for dev only). |
| `pnpm db:seed:categories`          | Seed expert-profile categories.                                                                                                                                                | Yes                                                  |
| `pnpm db:fix:stripe-state-machine` | Idempotent recovery for partial Drizzle Kit migrations on `stripe_webhook_events` (e.g. enum value half-applied). Uses `ADD VALUE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`. | Yes                                                  |
| `pnpm db:backfill:org-slugs`       | Backfill `slug` on existing organizations.                                                                                                                                     | Yes                                                  |

For Drizzle CLI commands (`db:push`, `db:generate`, `db:rls`, etc.)
run `pnpm --filter @eleva/db <command>` directly — those are
schema-management primitives, not operator workflows.

### Flags

| Command           | What it does                                                               | Idempotent? |
| ----------------- | -------------------------------------------------------------------------- | ----------- |
| `pnpm flags:sync` | Sync the local feature-flag definitions into Vercel Edge Config + PostHog. | Yes         |

## Required env vars (per command)

Every script reads from `.env.local` by default. To run against a
different environment, prefix the command with the env override or
swap your `.env.local` to the target environment's values.

| Var                                      | Used by                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                      | All `stripe:*` commands                                                               |
| `STRIPE_API_VERSION`                     | `stripe:setup:webhooks` (pins endpoint api_version)                                   |
| `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` | `apps/api` `/billing/portal` route after `stripe:setup:portal -- --apply`             |
| `STRIPE_PUBLISHABLE_KEY`                 | `stripe:setup:webhooks` (loaded by `@eleva/billing`)                                  |
| `STRIPE_CONNECT_CLIENT_ID`               | `stripe:setup:webhooks` (loaded by `@eleva/billing`)                                  |
| `WORKOS_API_KEY`                         | `workos:rbac:generate`, `stripe:backfill:org-customers`, `stripe:verify:entitlements` |
| WorkOS access token JWT                  | Optional for `stripe:verify:entitlements -- --access-token <jwt>`                     |
| `QSTASH_TOKEN`                           | All `qstash:*` commands                                                               |
| `QSTASH_URL`                             | All `qstash:*` commands (defaults to `https://qstash.upstash.io`)                     |
| `WORKFLOWS_DRAIN_SECRET`                 | `qstash:setup:audit-drainer`, `qstash:setup:stripe-stuck`, `qstash:setup`             |
| `API_BASE_URL`                           | All `qstash:*` setup commands. **Must be a public URL** (no localhost).               |
| `DATABASE_URL`                           | All `stripe:backfill:*`, `stripe:replay:*`, `db:*` commands                           |
| `AUDIT_DATABASE_URL`                     | `db:*` commands that touch the audit Neon project                                     |

`stripe:verify:entitlements` always needs `DATABASE_URL` and `WORKOS_API_KEY`.
It needs `STRIPE_SECRET_KEY` only when the diagnostic Stripe API comparison is
enabled; pass `-- --no-stripe-api` for a JWT/customer-link check without Stripe.

## Promoting staging → production

The promotion checklist runs **all of the same scripts** against the
target environment. Each is idempotent so re-running on prod after
they were initially run on staging is safe.

### Stripe — sandbox → live

1. **Switch to a live `STRIPE_SECRET_KEY`** in your shell. Live keys start with `sk_live_` instead of `sk_test_`.
2. **Re-seed the catalog**:

   ```bash
   pnpm stripe:seed
   ```

   Re-creates products, prices, and entitlements in the live account.

3. **Set up the webhook endpoint** pointing at production:

   ```bash
   pnpm stripe:setup:webhooks -- \
     --url https://api.eleva.care/webhooks/stripe --apply
   ```

   The script prints a fresh `whsec_*` secret on creation. **Save it immediately** — it's never shown again.

4. **Set up the Customer Portal configuration**:

   ```bash
   pnpm stripe:setup:portal -- --apply
   ```

   Save the printed `bpc_*` ID as `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` on Vercel `elevacare-api`.

5. **Update `STRIPE_WEBHOOK_SECRET`** on Vercel `elevacare-api` Production with the new whsec, then redeploy so the route picks it up.
6. **Backfill orgs to live customers**:

   ```bash
   pnpm stripe:backfill:org-customers --apply
   ```

   Creates a live Stripe customer for every WorkOS org that doesn't yet have one (and upserts the `billing_customers` mirror). Existing rows are no-ops.

### WorkOS — staging → production

1. **Switch to a production `WORKOS_API_KEY`** in your shell.
2. **Sync RBAC**:

   ```bash
   pnpm workos:rbac:generate
   ```

3. Verify in the WorkOS Dashboard → RBAC tab that all roles + permissions match `infra/workos/rbac-config.json`.

### QStash — same account, target prod URL

QStash is shared across envs; schedules differentiate by destination
URL. After your prod API is deployed:

```bash
API_BASE_URL=https://api.eleva.care pnpm qstash:setup
pnpm qstash:list   # confirm all three are present
```

### DB — apply migrations

```bash
DATABASE_URL=postgresql://prod-...  pnpm --filter @eleva/db db:push
DATABASE_URL=postgresql://prod-...  pnpm --filter @eleva/db db:rls
```

For the audit DB:

```bash
AUDIT_DATABASE_URL=postgresql://audit-prod-...  pnpm --filter @eleva/db db:push:audit
```

### Flags — push to prod Edge Config

```bash
pnpm flags:sync
```

(`@eleva/flags` reads the active `.env` to pick the target Edge
Config + PostHog environment.)

## Where scripts live

The repo follows a three-tier convention:

- **`infra/<vendor>/`** — Real workspaces (`@eleva/infra-stripe`,
  `@eleva/infra-workos`, `@eleva/infra-qstash`). Vendor-scoped SDK
  deps stay isolated. One workspace per external system. Add new
  vendors here when you start integrating a new external service that
  needs more than one or two scripts.
- **`packages/<pkg>/scripts/`** — Maintenance tied to a package's
  domain. `@eleva/db` owns DB recovery + backfills,
  `@eleva/flags` owns flag sync. Keep scripts here when they need
  package-internal types or invariants the vendor scripts don't have
  visibility into.
- **`apps/<app>/scripts/`** — Reserved for app-bound build/CI helpers
  (none today). Avoid putting external-service provisioning scripts
  here; route those to `infra/<vendor>/`.

Whenever you add a new script:

1. Decide which tier owns it (vendor / domain / app).
2. Add a named `pnpm <verb>:<noun>` entry in the workspace's own `package.json`.
3. Add a forwarder entry in the root `package.json` so it shows up in `pnpm <tab>`.
4. Add a row to this catalog with what it does + idempotency.
5. If it's part of a promotion runbook, add it to the matching section above.
