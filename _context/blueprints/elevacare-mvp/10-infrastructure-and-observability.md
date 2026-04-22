# 10 — Infrastructure & Observability

> Hosting, persistence, caching, file storage, error tracking, uptime monitoring, bot detection — what we keep, what we drop, what we fix.

## Inventory

| Concern              | MVP                                              | v2                                                                                          |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **Hosting**          | Vercel (single project)                          | Vercel (single project, monorepo with `apps/web`)                                           |
| **Runtime**          | Node.js (Vercel managed)                         | Node.js 24 (Vercel) + **Bun for local dev** (per branch's `BUN-RUNTIME-MIGRATION.md`)       |
| **App DB**           | Neon Postgres via `neon-http` driver             | Neon Postgres via `@neondatabase/serverless` (pooled) — supports transactions               |
| **Audit DB**         | Neon Postgres separate URL                       | Same — kept for separate retention                                                          |
| **Cache / locks**    | Upstash Redis                                    | Upstash Redis (kept; atomic SET NX everywhere)                                              |
| **Queue / cron**     | Upstash QStash                                   | **Vercel Workflows SDK** (see [09-workflows-and-async-jobs.md](09-workflows-and-async-jobs.md)) |
| **File storage**     | Vercel Blob                                      | Vercel Blob (kept)                                                                          |
| **Auth / Identity**  | Clerk                                             | **WorkOS AuthKit** (see [05-identity-auth-rbac.md](05-identity-auth-rbac.md))                |
| **Encryption**       | AES-256-GCM with single env key                   | **WorkOS Vault** envelope encryption (see [17-encryption-and-vault.md](17-encryption-and-vault.md)) |
| **Email**            | Novu Framework + Resend                          | **Resend only** (transactional + Automation + Audiences) — see [08](08-notifications-email-resend-crm.md) |
| **Payments**         | Stripe Connect + Identity                        | Stripe Connect + Identity + Subscriptions (lookup keys)                                     |
| **Calendar**         | Google Calendar API                              | Google Calendar API (refresh tokens in Vault)                                               |
| **Error tracking**   | Sentry                                           | Sentry (kept)                                                                               |
| **Uptime / heartbeats** | BetterStack                                   | BetterStack (kept)                                                                          |
| **Bot detection**    | BotID                                            | BotID (kept)                                                                                |
| **Analytics**        | PostHog                                          | **DROPPED** — revisit when scale + GDPR justify cost                                        |
| **Short links**      | Dub                                               | **DROPPED** — no clear product use                                                          |
| **Notification orchestration** | Novu                                    | **DROPPED** — Resend Automation covers lifecycle                                            |
| **Docs site**        | None / `docs/` markdown                          | **Fumadocs** (per branch)                                                                   |
| **Testing**          | Minimal Jest fragments                           | **Vitest** (unit + integration) + **Playwright** (E2E)                                      |
| **Video assets**     | None                                             | **next-video / Mux** for testimonials and content                                           |

## Database (Neon)

### What changes

Drop the `neon-http` driver. Reasons:

- No transaction support → multi-statement workflows are not atomic.
- Webhook handlers can't safely combine `INSERT meeting + INSERT transfer + DELETE reservation`.
- The `clerk-workos` branch already migrated to `@neondatabase/serverless` with the pooled driver.

### Connection model

```ts
// packages/db/client.ts
import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.fetchConnectionCache = true;

const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function withOrgContext<T>(orgId: string, role: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
    await tx.execute(sql`SET LOCAL app.role = ${role}`);
    return fn(tx);
  });
}
```

### RLS

Enable Postgres row-level security on every tenant-scoped table; policies read `app.current_org_id` and `app.role` (set by `withOrgContext`). See [03-data-model.md](03-data-model.md) for examples.

### Migrations

Drizzle Kit. Migrations checked in under `packages/db/migrations/`. Production migrations run in CI before deploy promotion (or via `vercel deploy --prebuilt` step).

## Audit log

Stays in a separate Neon DB to allow:

- Different retention (e.g., 7 years for the audit log, 30 days for application data).
- Different backup cadence.
- Reduced blast radius if app DB is compromised.

Schema lives in `packages/db/audit-schema.ts`. See [11-admin-audit-ops.md](11-admin-audit-ops.md).

## Redis (Upstash)

Kept for:

- **Slot reservations** — atomic `SET NX` lock per slot.
- **`FormCache`** — in-flight form-state cache. Fix the TOCTOU bug documented in `AGENTS.md` by using atomic `SET NX` or Lua script.
- **`RateLimitCache`** — rate limiting on auth, public endpoints, webhooks.
- **`CustomerCache`** — short-TTL Stripe customer lookups.
- **Webhook event monitor** — track Stripe event throughput.
- **Workflow input dedup** — backstop idempotency for triggered workflows.

Module: `packages/cache` (formerly [lib/redis/manager.ts](../../lib/redis/manager.ts)).

### Pattern: atomic SET NX lock

```ts
// packages/cache/lock.ts
export async function withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
  const token = crypto.randomUUID();
  const ok = await redis.set(key, token, { nx: true, px: ttlMs });
  if (!ok) return null;
  try {
    return await fn();
  } finally {
    // Lua to release only if token matches
    await redis.eval(`if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end`, [key], [token]);
  }
}
```

## File storage (Vercel Blob)

Kept. Used for:

- Expert profile photos.
- Patient document uploads (Patient Portal in v2).
- Generated PDF invoices.
- Open Graph image cache.

`packages/storage` wraps the Vercel Blob SDK and emits Sentry breadcrumbs.

Sensitive uploads (e.g., patient documents) are encrypted at rest via WorkOS Vault before being stored in Blob — Blob holds ciphertext, Vault holds the key. See [17-encryption-and-vault.md](17-encryption-and-vault.md).

## Observability

### Sentry

Kept. Three configs (`sentry.{client,server,edge}.config.ts` in `apps/web`). Tag every event with:

- `org_id` (current request's org)
- `actor_user_id` (authenticated user)
- `workflow:name` + `step:id` (inside Vercel Workflows)
- `webhook:source` (stripe / workos / resend) for webhook events

### BetterStack

Kept. Heartbeat cron (`systemHealth`) pings every 5 minutes. Per-workflow alerts when failure rate > 5% over 1 hour.

### BotID

Kept. Configured in [next.config.ts](../../next.config.ts). Protects:

- Public booking funnel against scrapers.
- Newsletter signup against bot floods.
- Become-Partner application form.

### Logging

Use Sentry breadcrumbs + Vercel Logs. No external log aggregator (Loki/Datadog) until product-market-fit justifies the cost.

## What we drop

### PostHog

**Why**:
- We don't currently use cohort analysis, A/B testing, or product analytics meaningfully.
- GDPR consent banner overhead.
- Bundle weight on every public page.
- Operational noise (monthly events budget tracking).
- Email delivery analytics live in Resend already.
- Conversion funnels can be reconstructed from Stripe + DB queries when needed.

**When to revisit**: Phase 2 or 3, when growth experiments need cohort-level insight and the team can dedicate someone to maintain event quality.

### Dub

**Why**:
- We don't have a clear product use case for branded short links.
- Yet another integration to monitor.
- Incremental value < incremental cost.

### Novu

**Why**: covered fully in [08-notifications-email-resend-crm.md](08-notifications-email-resend-crm.md). Net: Resend covers transactional, Automation covers lifecycle, Audiences covers lite CRM. Novu becomes net cost without commensurate benefit.

## Bun + Node hybrid

Branch reference: `_docs/03-infrastructure/BUN-RUNTIME-MIGRATION.md`. Adopt-as-is.

- **Local dev**: `bun --bun next dev` — faster install, faster cold start.
- **CI / Production**: Node.js 24 LTS on Vercel.
- **Test runner**: Vitest works on both.

The hybrid keeps the dev loop snappy without committing the production runtime to Bun (Vercel-managed Node.js is more battle-tested for production).

## Testing

### Vitest

Unit + integration. Per-package `vitest.config.ts`. Coverage gates in CI.

Targets:
- All `packages/*` exports have at least one test.
- Workflows have happy-path + idempotency tests.
- Slot algorithm has DST + timezone tests.
- Webhook handlers have signature-verification + duplicate-event tests.

### Playwright

E2E. Targets:

- Booking happy path (Card).
- Booking happy path (Multibanco).
- Expert onboarding wizard end-to-end.
- Admin payout approval flow.
- Patient Portal navigation.

Run on PR (smoke subset) and nightly (full suite).

## Documentation site

Branch reference: `_docs/` adopts Fumadocs. Adopt-as-is.

- Lives in `apps/docs` inside the monorepo.
- Hosts: this blueprint, internal SOPs, expert-facing API/integration docs (if/when needed), evidence-based-care content with academic footnote rendering.
- Deployed at `docs.eleva.care`.

## Video

`next-video` + Mux for:

- Expert testimonials.
- Founder/team videos.
- Onboarding walkthroughs for experts.

Hosted on Mux for adaptive streaming + thumbnails. Mux handles CDN.

## Environment taxonomy reset

The MVP `.env` mixes Clerk, Novu, QStash, PostHog, Dub. v2 cleans this up:

| Group              | Variables                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Database**       | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUDITLOG_DATABASE_URL`                                                       |
| **WorkOS**         | `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_REDIRECT_URI`, `WORKOS_WEBHOOK_SECRET`, `WORKOS_VAULT_*` |
| **Stripe**         | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_API_VERSION`, `STRIPE_PLATFORM_FEE_PERCENTAGE` |
| **Resend**         | `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`, `RESEND_AUDIENCE_PATIENTS_ID`, `RESEND_AUDIENCE_EXPERTS_ID`, `RESEND_AUDIENCE_NEWSLETTER_ID` |
| **Google OAuth**   | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URL`                                    |
| **Vercel**         | `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET` (still used by `vercel.ts` crons)                                               |
| **Upstash Redis**  | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                                   |
| **Sentry**         | `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`                                                                          |
| **BetterStack**    | `BETTERSTACK_HEARTBEAT_*` per scheduled job                                                                            |
| **BotID**          | `BOTID_*`                                                                                                              |
| **App**            | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_ENV`                                                                           |
| **DROPPED**        | All `CLERK_*`, `NOVU_*`, `QSTASH_*`, `POSTHOG_*`, `DUB_*`                                                              |

## Concrete checklist for the new repo

- [ ] `packages/db` uses `@neondatabase/serverless` pooled driver; transactions work.
- [ ] All tenant tables have RLS enabled; `withOrgContext` is the only read/write path.
- [ ] `packages/cache` exposes `withLock()` (atomic SET NX + token-checked release).
- [ ] No QStash, no Novu, no PostHog, no Dub in `package.json` or `.env*`.
- [ ] Sentry tags every event with `org_id`, `actor_user_id`, and workflow context where applicable.
- [ ] BetterStack heartbeat fires every 5 min from `systemHealth` cron.
- [ ] BotID configured for public booking, newsletter, and partner-application forms.
- [ ] Vercel Blob holds only ciphertext for sensitive uploads (Vault key reference stored alongside).
- [ ] Vitest config in every package; Playwright suite in `apps/web/tests/`.
- [ ] Local dev uses Bun (`bun --bun next dev`); CI/prod uses Node 24 LTS.
- [ ] `apps/docs` (Fumadocs) deploys to `docs.eleva.care`.
- [ ] `apps/web` uses `next-video` for any video asset (no manual `<video>` tags).
- [ ] Single `vercel.ts` config replaces `vercel.json`.
