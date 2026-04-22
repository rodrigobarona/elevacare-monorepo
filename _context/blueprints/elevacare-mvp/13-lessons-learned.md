# 13 — Lessons Learned

> The single most important chapter for the rebuild. Each row is a real symptom seen in production, the file/path it lives in, the root cause, and the explicit v2 mitigation. Read this before writing the first line of v2 code.

## Format

| # | Symptom | File / area | Root cause | v2 mitigation | Severity |
|---|---------|-------------|------------|---------------|----------|

## Catalog

| # | Symptom | File / area | Root cause | v2 mitigation | Severity |
|---|---------|-------------|------------|---------------|----------|
| 1 | Multi-statement DB writes leave partial state on retry | [drizzle/db.ts](../../drizzle/db.ts) — `neon-http` driver | `neon-http` driver doesn't support transactions | Switch to `@neondatabase/serverless` pooled driver (adopt-as-is from `clerk-workos` branch); use `db.transaction()` everywhere | **High** |
| 2 | Disputes/refunds fail to send notifications | [app/api/webhooks/stripe/handlers/payment.ts](../../app/api/webhooks/stripe/handlers/payment.ts) | PaymentIntent enrichment runs **after** an early return that branches on event type; subscriber payload missing → Novu trigger silently no-ops | Always enrich the PaymentIntent BEFORE any branching in `processStripeEvent()` wrapper (see [06-payments-stripe-connect.md](06-payments-stripe-connect.md)); explicit Vitest test covering refund/dispute Resend trigger | **High** |
| 3 | Duplicate Google Calendar events / Meet invites for one booking | [server/googleCalendar.ts](../../server/googleCalendar.ts) | Stripe webhook retry triggers `events.insert` twice; no client-supplied event ID | Adopt the branch's idempotent calendar pattern (`_docs/02-core-systems/payments/11-calendar-creation-idempotency.md`): client-supplied `events.insert` ID + 409 fallback to `events.get` | **High** |
| 4 | TOCTOU race on `FormCache` lets two concurrent writers process the same form | [lib/redis/manager.ts](../../lib/redis/manager.ts) (`FormCache`) | `isProcessing` GET + `set` is not atomic | Use atomic `SET NX` lock (Redis SET with NX flag and TTL) for every "in-flight" check; provide `withLock()` helper in `packages/cache` | **High** |
| 5 | `proxy.ts` is a 740+ line god-file mixing Clerk, i18n, RBAC, route allowlists, locale detection, expert-setup gate, cron auth | [proxy.ts](../../proxy.ts) | Organic accretion; nothing forced separation | Split into composable handlers under `src/lib/proxy/*` — `src/proxy.ts` orchestrator stays under 50 lines (per branch's `_docs/04-development/PROXY-MIDDLEWARE.md`) | **Medium** |
| 6 | QStash schedules silently drop to 0 firings | Setup script in `scripts/`; [config/qstash.ts](../../config/qstash.ts) | Setup script must be re-run after env changes; nothing alerts when schedules vanish | Replace QStash with **Vercel Workflows SDK**; truly periodic jobs go in `vercel.ts` cron config and trigger workflows; BetterStack heartbeat alerts on missing fires | **High** |
| 7 | Multibanco D3/D6 reminder reliability tied to QStash health | [app/api/cron/send-payment-reminders/](../../app/api/cron/send-payment-reminders/) | Polling-based; if scheduler dies, reminders silently stop; conversion drops with no signal | Workflows triggered on `payment_intent.processing` event; per-step idempotency; cancellable on `succeeded`/`failed` | **High** |
| 8 | Cron handlers have **zero** test coverage | [app/api/cron/](../../app/api/cron/) | Tests were never written; CI doesn't gate on cron coverage | Vitest tests for every workflow + happy-path/idempotency/cancellation; CI fails on uncovered new workflow | **Medium** |
| 9 | Three Stripe webhook routes overlap | [app/api/webhooks/stripe/](../../app/api/webhooks/stripe/), [stripe-connect/](../../app/api/webhooks/stripe-connect/), [stripe-identity/](../../app/api/webhooks/stripe-identity/) | Initial split was by Stripe product, not by handler logic; events route ambiguously | Single endpoint `/api/stripe/webhook` with typed dispatch in `packages/payments`; idempotency at choke point | **Medium** |
| 10 | Idempotency on `stripe_processed_events` is **inconsistent** across handlers | [app/api/webhooks/stripe/handlers/](../../app/api/webhooks/stripe/handlers/) | Each handler reinvents the pattern; some skip the insert | Force every handler through `processStripeEvent(event)` wrapper that does the `INSERT ... ON CONFLICT DO NOTHING` | **High** |
| 11 | Promo codes can erase platform fee | [config/stripe.ts](../../config/stripe.ts) `MARKETPLACE_SPLIT.FEE_BASIS` | Some ad-hoc handlers used the discounted amount as the fee basis instead of the listing price | Centralize `calculateApplicationFee()` with explicit `listingAmountPreTaxPreDiscount` argument; tests for promo-code scenarios; persist `app_fee_bps` and `app_fee_amount` on the meeting row for audit | **High** |
| 12 | Stripe Tax used to require billing address, blocking PT checkouts | Stripe Tax dashboard config + checkout setup | Default Stripe Tax setup required address; PT customers only have NIF | Stripe Tax dashboard configured to honor NIF without address; v2 `checkout.ts` passes `billing_address_collection: 'never'` for PT customers; Vitest test against PT NIF flow (per `AGENTS.md`) | **High** |
| 13 | Stale `MeetingForm` duplicate keeps getting edited | `src/components/features/forms/MeetingForm.tsx` (stale) vs [components/features/forms/MeetingForm.tsx](../../components/features/forms/MeetingForm.tsx) (canonical) | Both files exist; tooling/agents pick the wrong one | v2 lives entirely under `src/`; canonical is the only file. CI lint blocks accidental duplicates; `AGENTS.md` records the trap permanently | **Medium** |
| 14 | Single AES-256-GCM `ENCRYPTION_KEY` for all PHI and all Google tokens | `ENCRYPTION_KEY` env var; [server/utils/tokenUtils.ts](../../server/utils/tokenUtils.ts) | One key, one secret, no rotation, blast radius = entire DB | WorkOS Vault envelope encryption with org-scoped keys (per branch's `_docs/_WorkOS Vault implemenation/`); see [17-encryption-and-vault.md](17-encryption-and-vault.md) | **High** |
| 15 | Google Calendar refresh tokens stored in app DB | [drizzle/schema.ts](../../drizzle/schema.ts) `users.googleRefreshToken` | OAuth flow persisted tokens to DB column; encrypted but co-located with everything else | Tokens move to WorkOS Vault (org-scoped); DB stores only `vault_item_id`; per branch's `WORKOS-SSO-VS-CALENDAR-OAUTH.md` | **High** |
| 16 | RBAC drift between Clerk metadata and local `users.role` | [lib/auth/roles.server.ts](../../lib/auth/roles.server.ts), Clerk webhook | Two sources of truth; webhook misfires desync them | WorkOS as single source; JWT claims carry `role` + `permissions[]`; nightly RBAC drift checker (`scripts/workos/rbac-drift-check.ts`) | **Medium** |
| 17 | Authorization drift between proxy / layout / server action layers | [proxy.ts](../../proxy.ts), `app/(private)/admin/layout.tsx`, ad-hoc checks in actions | No enforced four-layer model; layers can disagree | Mandatory four-layer model: L1 proxy + L2 layout + L3 `withPermission` decorator + L4 Postgres RLS (see [18-rbac-and-permissions.md](18-rbac-and-permissions.md)) | **High** |
| 18 | No row-level security in Postgres | [drizzle/schema.ts](../../drizzle/schema.ts) | App-level checks only; a buggy server action leaks tenant data | RLS enabled on every tenant table; `withOrgContext()` is the only DB read/write surface | **High** |
| 19 | Audit log coverage is partial | [drizzle/auditSchema.ts](../../drizzle/auditSchema.ts) | Mutating server actions don't always insert audit rows | `withAudit()` decorator wrapping every mutating server action; correlation IDs end-to-end | **Medium** |
| 20 | Audit `clerkUserId` is vendor-locked | [drizzle/auditSchema.ts](../../drizzle/auditSchema.ts) | Stored Clerk's user ID as the actor key | Rename to `actor_user_id` (WorkOS user ID); add `correlation_id`, `actor_org_id`, `target_org_id`, `source` (per [11-admin-audit-ops.md](11-admin-audit-ops.md)) | **Low** |
| 21 | Tenancy column is `clerkUserId text` everywhere | [drizzle/schema.ts](../../drizzle/schema.ts) | Vendor-coupled; rewriting joins required to leave Clerk | Tenancy column is `org_id uuid` referencing local `organizations` mirror of WorkOS orgs (org-per-user) | **High** |
| 22 | Setup state stored in Clerk metadata | Clerk `public_metadata.expert_setup` | Vendor-locked, hard to query, hard to back-fill | Store on `organizations.metadata.expert_setup jsonb` in DB | **Medium** |
| 23 | No expert subscription model in DB | (missing) | MVP didn't anticipate subscriptions | New `subscriptions` table mirroring Stripe; lookup-key based; per-tier fee override (see [16-subscriptions-and-three-party-revenue.md](16-subscriptions-and-three-party-revenue.md)) | **Medium** |
| 24 | Hardcoded `price_xxx` IDs in scripts | various scripts | Stripe price IDs leaked into code; rotating prices breaks code | Stripe **lookup keys** registry; `packages/payments/lookup-keys.ts` is the only source | **Medium** |
| 25 | Cron jobs alert via Novu (which we're removing) | [config/qstash.ts](../../config/qstash.ts) `monitoring.alerting.channels: ['email', 'in-app']` | Coupled to Novu | BetterStack heartbeat per workflow; Sentry-tagged step failures; Resend transactional for ops digest | **Medium** |
| 26 | README declares Next.js 14 while repo runs Next.js 16 + React 19 | [README.md](../../README.md) | Doc drift | v2: README is auto-generated from `package.json` + Vercel project; CI gates README/`AGENTS.md` updates on relevant file changes | **Low** |
| 27 | `_docs/` was empty stubs while `docs/` had real content | `_docs/` (pre-blueprint) vs `docs/` | Two doc trees, neither canonical | Single canonical `_docs/blueprint/` (this folder) + `apps/docs` Fumadocs site for everything else; `docs/` archived | **Low** |
| 28 | `WORKFLOW_IDS` referenced deleted Novu workflows | [config/novu-workflows.ts](../../config/novu-workflows.ts) | Stale enum entries → silent no-op triggers | Drop Novu entirely; templates referenced by typed `TemplateId` union | **Medium** |
| 29 | DST and timezone bugs at booking edges | `getValidTimesFromSchedule.ts`, [server/googleCalendar.ts](../../server/googleCalendar.ts) | DIY offset math instead of `date-fns-tz` | Use `date-fns-tz` everywhere; explicit DST tests in `packages/scheduling` | **Medium** |
| 30 | Patient timezone defaults trip on travel | booking funnel | Default to user's account timezone instead of browser timezone | Detect via `Intl.DateTimeFormat().resolvedOptions().timeZone`; persist on `meetings.patientTimezone` | **Low** |
| 31 | Google Meet link sometimes missing | [server/googleCalendar.ts](../../server/googleCalendar.ts) | `conferenceData.createRequest` occasionally returns without populated link | Post-insert `events.patch` if `hangoutLink` missing; retry with backoff | **Medium** |
| 32 | Token refresh failures silent | [server/utils/tokenUtils.ts](../../server/utils/tokenUtils.ts) | `invalid_grant` swallowed; calendar create fails silently | Self-healing: emit `expert_calendar_disconnected` Resend Automation event; queue calendar create for retry once tokens are restored | **Medium** |
| 33 | Two health endpoints (`/api/health`, `/api/healthcheck`) | [app/api/health/](../../app/api/health/), [app/api/healthcheck/](../../app/api/healthcheck/) | Naming convention drift | One: `/api/health`. BetterStack and internal probes both consume it. | **Low** |
| 34 | Two user endpoints (`/api/user`, `/api/users`) | [app/api/user/](../../app/api/user/), [app/api/users/](../../app/api/users/) | Same drift | Singular = current user; plural = list (admin only) | **Low** |
| 35 | `app/PostHogPageView.tsx` ships even when PostHog is disabled | [app/PostHogPageView.tsx](../../app/PostHogPageView.tsx) | Always-rendered client component | Drop PostHog entirely (see [10-infrastructure-and-observability.md](10-infrastructure-and-observability.md)) | **Low** |
| 36 | Dub short-link integration unused | [lib/integrations/dub/](../../lib/integrations/dub/) | Never adopted by product | Drop Dub | **Low** |
| 37 | Translation drift across `messages/*.json` | [messages/](../../messages/) | No CI guard for key parity | `scripts/i18n/check-keys.ts` enforces parity in CI | **Medium** |
| 38 | `pt-BR` ↔ `br` asymmetry undocumented | [messages/br.json](../../messages/br.json) + locale config | Developer surprise | Permanent doc in `apps/web/i18n/README.md` and this blueprint | **Low** |
| 39 | Cache Components disabled in Next 16 | [next.config.ts](../../next.config.ts) | next-intl doesn't yet support `cacheComponents` (issue #1493) | TODO comment with upstream link; revisit when supported | **Low** |
| 40 | No Patient Portal | (missing) | Patients live in the public funnel forever | Adopt branch's `_docs/_rethink folder and menu structure/PATIENT-PORTAL-SPECIFICATION.md` | **Medium** |
| 41 | No Become-Partner application form | (missing) | Expert acquisition is manual email | First-class form + admin queue (see [11-admin-audit-ops.md](11-admin-audit-ops.md)) | **Medium** |
| 42 | No clinic three-party revenue support | [config/stripe.ts](../../config/stripe.ts) | Two-party only | Phase 2 model behind feature flag (see [16-subscriptions-and-three-party-revenue.md](16-subscriptions-and-three-party-revenue.md)) | **Low** |
| 43 | RBAC is a single string per user | Clerk metadata, `users.role` | No granular permissions | 5 roles (2 WorkOS defaults + 3 custom) × ~132 permissions in JWT claims (lift from branch `_docs/_WorkOS RABAC implemenation/`, renamed to v2 taxonomy); see [18-rbac-and-permissions.md](18-rbac-and-permissions.md) | **High** |
| 44 | Sync between auth provider and DB blocked auth flow | Clerk webhook handler | DB write failure caused webhook retry storm and slow auth | WorkOS sync is **non-blocking**: best-effort immediate sync + webhook eventual consistency, never blocks auth (per branch `_docs/02-core-systems/workos-sync-architecture.md`) | **High** |
| 45 | One-off scripts not idempotent | [scripts/](../../scripts/) | Re-running can double-process | All scripts take `--dry-run`; idempotent by default; logged to Sentry | **Low** |
| 46 | No correlation IDs across services | request → workflow → email | Hard to trace incidents | Inject `x-correlation-id` in proxy; propagate to workflows, audit, Resend tags, Sentry | **Medium** |
| 47 | Encryption key rotation = downtime | `ENCRYPTION_KEY` env | Rotating requires re-encrypting every record | Vault handles rotation; key references on rows mean rotation is metadata-only | **Medium** |
| 48 | No clear "expert calendar disconnected" UX | calendar integration | Failure mode invisible to expert | Resend Automation triggers email with reconnect link; admin dashboard surfaces broken Google connections | **Medium** |
| 49 | Webhook signature secrets reused across envs | env config | Same `STRIPE_WEBHOOK_SECRET` in dev/staging/prod historically | Per-env secrets; CI lint asserts non-equality across envs | **Low** |
| 50 | Stripe API version pinned in env, not code | `STRIPE_API_VERSION` env | Easy to drift across envs | Pin in `packages/payments/client.ts`; env override only for emergencies | **Low** |

## Recurring patterns

Across the catalog, three patterns explain most of the 50 incidents:

1. **Vendor coupling** (Clerk user IDs in tables, single encryption key, Novu workflow IDs, hardcoded Stripe prices) — solved by **abstraction packages** (`packages/auth`, `packages/encryption`, `packages/payments`) and **stable internal identifiers** (org_id, lookup keys).

2. **Implicit / partial idempotency** (Stripe webhook retries, calendar event creation, Multibanco reminders, scripts) — solved by **mandatory wrappers** (`processStripeEvent`, `withLock`, `withAudit`) and **client-supplied IDs** wherever the upstream API supports it.

3. **God-files / non-composable infrastructure** (740-line proxy, three Stripe webhook routes, polling crons) — solved by **composition** (proxy handler chain, single Stripe webhook + typed dispatcher, event-triggered workflows).

If a v2 PR is fixing a symptom that doesn't trace back to one of these three patterns, pause and reconsider the design.

## Concrete checklist for the new repo

- [ ] Every row in this catalog has its v2 mitigation present in the implementation.
- [ ] CI gates on translation parity, cron coverage, idempotency-wrapper usage.
- [ ] No vendor IDs in tenant columns; all use `org_id` / `actor_user_id`.
- [ ] No `proxy.ts` over 50 lines.
- [ ] No webhook handler that doesn't go through its idempotency wrapper.
- [ ] Vault is the only encryption surface for PHI and OAuth tokens.
- [ ] Workflows replace cron polling for any event-triggered async job.
