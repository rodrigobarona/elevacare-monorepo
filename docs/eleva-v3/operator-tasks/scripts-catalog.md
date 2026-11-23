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

| Command                          | What it does                                                                                                                                                                                                              | Idempotent?                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm stripe:setup:webhooks`     | Create or update the `https://api.eleva.care/webhooks/stripe` endpoint with the canonical 20-event list. Pins `api_version` from `STRIPE_API_VERSION`.                                                                    | Yes (delete + recreate the endpoint via Dashboard if `api_version` already drifted; Stripe locks it at creation). |
| `pnpm stripe:setup:portal`       | Create the Stripe Customer Portal configuration used by `POST /billing/portal`; save the printed ID as `STRIPE_BILLING_PORTAL_CONFIGURATION_ID`.                                                                          | Creates a new config; keep the active ID in env.                                                                  |
| `pnpm stripe:seed`               | Seed all Stripe products + entitlements (`--apply`).                                                                                                                                                                      | Yes — re-running upserts.                                                                                         |
| `pnpm stripe:seed:products`      | Seed Stripe products and prices only.                                                                                                                                                                                     | Yes                                                                                                               |
| `pnpm stripe:seed:entitlements`  | Seed Stripe Entitlements (mirrors `@eleva/flags` plan matrix).                                                                                                                                                            | Yes                                                                                                               |
| `pnpm stripe:replay:event evt_…` | Re-fetch one event from Stripe and re-run `processStripeEvent` against it. Resets the row's status before dispatching. Use to recover from `ignored` (re-process after backfill) or `failed` (real bug fix shipped) rows. | Yes                                                                                                               |

`stripe:verify:entitlements` and `stripe:backfill:org-customers` compared session entitlements claims / walked organizations (removed, see ADR-017). Phase 6 rewrites entitlement checks against Better Auth session + `@eleva/flags` and provisions Stripe customers on Better Auth org create.

### the previous identity provider (historical — removed, see ADR-017)

Do not run. `identity:rbac:generate`, `identity:widgets:generate` and `legacy identity env vars` env vars are deleted in Phase 3. RBAC SSOT is `packages/auth/src/permissions.ts` (ADR-021).

### QStash (Upstash)

QStash is shared across environments; schedules differentiate
themselves by destination URL. Re-run after rotating tokens or
changing API base URLs.

| Command                       | What it does                                                                                                                                                                                                                                                    | Idempotent? |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `pnpm qstash:list`            | Print every schedule + cross-check expected paths.                                                                                                                                                                                                              | Yes         |
| `pnpm qstash:setup`           | Provision every QStash schedule (`setup:all`): daily, monthly and payout jobs. Removes QStash schedules for the cadence ticks (`/workflows/tick/{minutely,10min,hourly}`) and their jobs, which run on Vercel Cron. `--with-retention` only after DPO sign-off. | Yes         |
| `pnpm qstash:setup:invoicing` | (Re)register the monthly `/workflows/stripe-toconline-reconciliation`; invoicing retry runs in the hourly tick.                                                                                                                                                 | Yes         |

All QStash setup commands accept `-- --dry-run` for preview-only mode.

### Cutover (Phase 15)

One approval for each production change, kept by the repository and not by a chat (ADR-019).

| Command                                    | What it does                                                                                                                                                                                                                                                      | Idempotent? |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `pnpm cutover:gate <step> -- <command...>` | Runs the command only when today's cutover log holds `<step> \| approved \| @rodrigobarona \| <time>`, in a commit the owner made, signed with their own key and pushed less than four hours ago. Writes `started`, then `executed` or `failed`, to the same log. | No          |

Before the day:

- **The owner needs a signing key registered on their GitHub account** (SSH or GPG), kept where an
  agent working on the same machine cannot use it without them: a key with a passphrase, a hardware
  key, or a password manager that asks each time. This is what makes an approval the owner's. A
  commit made on github.com, or by a merge button, is signed by GitHub and is refused: anyone holding
  the owner's GitHub login can make one.
- Work on the branch `phase-15/launch-cutover`, not on `main`: a push to `main` deploys every app,
  and `phase-*` branches do not deploy.
- The operator needs a full clone (`git fetch --unshallow` if it is not) and `gh` signed in with
  read access to the repository.

How a step goes:

1. The operator prints the step and the exact command, and stops.
2. The owner pulls the branch, adds the approval line at the end of
   `docs/eleva-v3/operator-tasks/cutover-log-YYYY-MM-DD.md` (the file of the current UTC day),
   commits it signed (`git commit -S`) and pushes.
3. The operator pulls and runs the step through the gate.
4. The operator copies what is safe from the evidence file into the log, **commits the log and
   pushes it at once**. The owner's next approval goes on top of that.

Good to know:

- An approval is good for one run, whether the run worked or not. A failed run may have changed
  something: look, then ask for a new line. Of several approval lines for one step, the last is the
  one read.
- **Commit the log before pulling, and never stash it.** The lines the gate writes are not committed
  until step 4. If the owner pushed the next approval first, the pull is a conflict at the end of the
  file: keep both sides, the gate's lines above the new approval. (The gate also keeps its own note
  that an approval was used, outside git's reach, so a stash cannot make one usable twice.)
- What the command printed is kept in `docs/eleva-v3/operator-tasks/cutover-evidence/`, which git
  ignores, because it can hold secrets.
- The gate refuses a command that looks like it carries a secret on its command line (the command is
  written to the log). It knows the common shapes, not every one: give secrets through the
  environment of the shell.
- The command runs from the repository root, without a shell, and what it prints goes through a pipe:
  a tool that asks a question only on a terminal will not ask it. A step that must run elsewhere says
  so in its command (`pnpm --dir infra/migration ...`).
- A step is a letter, then numbers and small letters: `B.2`, `B.1.a`, `C.4`, `B.9r`.
- A refusal exits with 2 and says why. Ctrl-C is passed to the command, and the gate waits for it to
  end so that the log gets its closing line.
- Cutover logs are not reformatted by the commit hook (`.prettierignore`): the log says what ran,
  character for character.

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

### Google OAuth (Better Auth + Calendar)

| Command                              | What it does                                                                                                                                                          | Idempotent? |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `pnpm check:google-oauth`            | Prints canonical Google Cloud redirect URIs + JS origins, consent scopes, and verifies `GOOGLE_OAUTH_CLIENT_ID` / `SECRET` + `BETTER_AUTH_URL` presence (no secrets). | Yes         |
| `pnpm clear:better-auth-rate-limits` | Deletes stuck Better Auth Redis rate-limit keys (`${ip}\|${path}`) that permanently 429 `/auth/sign-in/*` when TTL was never applied. Needs prod `KV_REST_API_*`.     | Yes         |

Operator guide: [`google-oauth-setup.md`](./google-oauth-setup.md).

## Required env vars (per command)

Every script reads from `.env.local` by default. To run against a
different environment, prefix the command with the env override or
swap your `.env.local` to the target environment's values.

| Var                                      | Used by                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                      | All `stripe:*` commands                                                   |
| `STRIPE_API_VERSION`                     | `stripe:setup:webhooks` (pins endpoint api_version)                       |
| `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` | `apps/api` `/billing/portal` route after `stripe:setup:portal -- --apply` |
| `STRIPE_PUBLISHABLE_KEY`                 | `stripe:setup:webhooks` (loaded by `@eleva/billing`)                      |
| `STRIPE_CONNECT_CLIENT_ID`               | `stripe:setup:webhooks` (loaded by `@eleva/billing`)                      |
| `QSTASH_TOKEN`                           | All `qstash:*` commands                                                   |
| `QSTASH_URL`                             | All `qstash:*` commands (defaults to `https://qstash.upstash.io`)         |
| `WORKFLOWS_DRAIN_SECRET`                 | `qstash:setup:invoicing`, `qstash:setup`                                  |
| `API_BASE_URL`                           | All `qstash:*` setup commands. **Must be a public URL** (no localhost).   |
| `DATABASE_URL`                           | All `stripe:backfill:*`, `stripe:replay:*`, `db:*` commands               |
| `AUDIT_DATABASE_URL`                     | `db:*` commands that touch the audit Neon project                         |
| `GOOGLE_OAUTH_CLIENT_ID`                 | `check:google-oauth` (presence only)                                      |
| `GOOGLE_OAUTH_CLIENT_SECRET`             | `check:google-oauth` (presence only)                                      |
| `BETTER_AUTH_URL`                        | `check:google-oauth` (derives `{BETTER_AUTH_URL}/callback/google`)        |

the previous identity provider API keys and session JWTs (removed, see ADR-017).

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
6. **Org → Stripe customer**: new Better Auth organizations call `provisionOrgBilling` on create (Phase 6). Do not walk organizations (removed, see ADR-017).

### the previous identity provider — staging → production (removed, see ADR-017)

Do not apply `the former identity infra package/rbac-config.json` or widget grants.

### QStash — same account, target prod URL

QStash is shared across envs; schedules differentiate by destination
URL. After your prod API is deployed:

```bash
API_BASE_URL=https://api.eleva.care pnpm qstash:setup
pnpm qstash:list   # confirm the four QStash schedules (monthly reconciliation, 3 payouts); ticks, which include the audit drainer, are under Vercel Cron Jobs
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
  `@eleva/infra-qstash`). `@eleva/infra-identity-legacy` is historical and deleted in Phase 3 (removed, see ADR-017). Vendor-scoped SDK
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
