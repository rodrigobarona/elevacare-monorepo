# `@eleva/infra-qstash` — QStash schedule provisioning

This workspace owns the registration of every QStash schedule that
drives Eleva's recurring workflows. It mirrors `infra/stripe/` and
`infra/workos/` — vendor-scoped operator scripts that talk to one
external system.

## Why a workspace and not just app scripts?

The schedules POST to `apps/api`, but the **provisioning tool** is
QStash. Keeping it under `infra/` (alongside Stripe, WorkOS, and
flags) makes the "external system → operator scripts" map symmetric
and avoids tying our deploy automation to the layout of any single
app.

## Schedules registered today

| Path                              | Cron           | Auth                            | Owner            |
| --------------------------------- | -------------- | ------------------------------- | ---------------- |
| `/workos/sync`                    | `*/5 * * * *`  | (none)                          | `@eleva/auth`    |
| `/workflows/audit-outbox-drainer` | `0 6,18 * * *` | bearer `WORKFLOWS_DRAIN_SECRET` | `@eleva/audit`   |
| `/workflows/stripe-stuck-events`  | `*/10 * * * *` | bearer `WORKFLOWS_DRAIN_SECRET` | `@eleva/billing` |

When you add a new schedule:

1. Create the route in `apps/api/src/app/...`.
2. Add a `setup-<name>.ts` here that calls `registerSchedule(...)` with the path + cron + auth requirements.
3. Add a step to `setup-all.ts` so a single `pnpm qstash:setup:all` provisions everything.
4. Add an entry in the `EXPECTED_PATHS` array in `list-schedules.ts` so the cross-check picks it up.

## Promoting staging → production

QStash today is a single account shared across environments;
schedules differentiate themselves by destination URL.

```bash
# Staging
API_BASE_URL=https://staging-api.eleva.care pnpm qstash:setup:all

# Production
API_BASE_URL=https://api.eleva.care pnpm qstash:setup:all
```

The script is idempotent — running it again deletes any prior
schedule with the same destination before creating a new one, so it's
safe to re-run after rotating tokens or changing crons.

## Required env vars

Read from `.env.local` (or the active env when running in CI):

| Var                      | When required                                           |
| ------------------------ | ------------------------------------------------------- |
| `QSTASH_TOKEN`           | Always                                                  |
| `QSTASH_URL`             | Optional (defaults to `https://qstash.upstash.io`)      |
| `API_BASE_URL`           | Always; must be a publicly reachable URL (no localhost) |
| `WORKFLOWS_DRAIN_SECRET` | When the schedule passes `requireBearer: true`          |

## Commands

| Command                           | What it does                                      |
| --------------------------------- | ------------------------------------------------- |
| `pnpm qstash:list`                | Print every schedule + cross-check expected paths |
| `pnpm qstash:setup:workos-sync`   | (Re)register the WorkOS Events poller             |
| `pnpm qstash:setup:audit-drainer` | (Re)register the audit outbox drainer             |
| `pnpm qstash:setup:stripe-stuck`  | (Re)register the Stripe stuck-event detector      |
| `pnpm qstash:setup:all`           | Run all three setup commands in sequence          |

All setup commands accept `-- --dry-run` to preview without writing.
