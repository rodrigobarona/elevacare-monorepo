# Stripe Phase 1 + 2 — Post-Merge Cutover Runbook

Status: Pending — execute the moment `stripe-audit` lands on `main`
and the production deploy of `elevacare-api` is `READY`.

This runbook is the single source of truth for everything that must
happen after the Stripe billing branch (commits `37813ec` →
`13a676f`, plus today's migration fix `0017`) merges to `main`.
Until each block here is checked off, the integration is not safe
to expose to real users.

> **TL;DR cause-and-effect.** Most of the work below is configuration
> that the branch's code expects to find in production. Skipping any
> single block leaves a route either dead, unauthenticated, or silently
> dropping events. Treat the order as a hard dependency graph.

---

## 0 · Pre-merge gate (do not merge until all four are true)

| Check                      | How to verify                                                           | Owner |
| -------------------------- | ----------------------------------------------------------------------- | ----- |
| Local build green          | `pnpm -r build` exits 0 (10/10 apps)                                    | dev   |
| Local typecheck green      | `pnpm -r typecheck` exits 0                                             | dev   |
| Local tests green          | `pnpm --filter @eleva/db --filter @eleva/billing test` (65/65)          | dev   |
| Vercel preview build green | Latest `stripe-audit` deploy on `elevacare-api` is `READY`, not `ERROR` | dev   |

> Currently failing: 6 consecutive `stripe-audit` preview deploys are
> in `ERROR` state across `elevacare-api` AND `elevacare-web` (each
> dies in ~1.5 s with no captured logs). Open one of the inspector
> URLs from `vercel deployments list` to read the actual build error,
> fix it, push, and verify a `READY` state before merging. Do not
> merge while previews are red — production will inherit the same
> failure.

---

## 1 · Database migrations on production Neon

The `eleva_v3_main` Neon project must end up with the four billing
migrations applied. **Locally these are already applied to your dev
DB**, but production is a separate Neon project.

### 1.1 Apply migrations

From a machine with `DATABASE_URL` pointing at the **production**
Neon project (set it temporarily — don't commit it):

```bash
DATABASE_URL=postgresql://prod-...  pnpm --filter @eleva/db db:push
```

Required migrations (in order):

| File                                             | Adds                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `0014_add_billing_mirror_and_webhook_events.sql` | `stripe_webhook_events`, `billing_customers`, `billing_subscriptions`, two enums |
| `0015_stripe_event_state_machine.sql`            | `processing` enum value, `attempts`, `last_attempt_at`, `ignore_reason` columns  |
| `0016_event_ordering_and_terminal_failures.sql`  | `failed_terminal` enum value, `last_event_created_at` column                     |
| `0017_drop_billing_subs_price_ids_default.sql`   | drops the array DB-default that caused diff false-drift                          |

If `db:push` fails with `enum label "processing" already exists`
(partial-apply scenario from a previous failed run), run the
idempotent recovery script instead:

```bash
DATABASE_URL=postgresql://prod-...  \
  pnpm --filter @eleva/db tsx scripts/fix-stripe-event-state-machine.ts
```

That uses `ADD VALUE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` and
prints the final schema state for verification.

### 1.2 Apply RLS

```bash
DATABASE_URL=postgresql://prod-...  pnpm --filter @eleva/db db:rls
```

Verify RLS is on the new tables:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('billing_customers', 'billing_subscriptions',
                    'stripe_webhook_events');
```

Both `billing_customers` and `billing_subscriptions` must have
`rowsecurity = true`. `stripe_webhook_events` is platform-scoped and
intentionally has RLS off (only the webhook processor and ops
scripts touch it).

### 1.3 Confirm zero drift

```bash
DATABASE_URL=postgresql://prod-...  pnpm --filter @eleva/db db:push
```

Expect `[i] No changes detected`. Anything else means the schema is
out of sync — investigate before continuing.

---

## 2 · Vercel environment variables (production)

Set on the **`elevacare-api` Vercel project, Production environment**
unless noted. After each batch, redeploy (Vercel doesn't pick up env
changes without a rebuild).

### 2.1 Stripe core

| Var                        | Source                                                      | Purpose                                                                        |
| -------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `STRIPE_SECRET_KEY`        | Stripe Dashboard → Developers → API keys (live `sk_live_…`) | All server-side Stripe calls                                                   |
| `STRIPE_PUBLISHABLE_KEY`   | Stripe Dashboard (`pk_live_…`)                              | Embedded Checkout client init (also needed in `elevacare-app`)                 |
| `STRIPE_WEBHOOK_SECRET`    | Stripe Dashboard → Webhooks → endpoint detail (`whsec_…`)   | Signature verification on `/webhooks/stripe`                                   |
| `STRIPE_API_VERSION`       | Default: `2026-04-22.dahlia`                                | API version pinning (must match the webhook endpoint's pinned version exactly) |
| `STRIPE_CONNECT_CLIENT_ID` | Connect → Settings → Platform settings (`ca_…`)             | Connect AccountSession minting                                                 |

### 2.2 Workflow auth (drainers + cron)

| Var                          | Source                              | Purpose                                     |
| ---------------------------- | ----------------------------------- | ------------------------------------------- |
| `WORKFLOWS_DRAIN_SECRET`     | Generate: `openssl rand -hex 32`    | Bearer token guarding `/workflows/*` routes |
| `QSTASH_TOKEN`               | Upstash QStash console              | Required to schedule workflows              |
| `QSTASH_URL`                 | Usually `https://qstash.upstash.io` | QStash REST endpoint                        |
| `QSTASH_CURRENT_SIGNING_KEY` | Upstash                             | Verifying QStash callbacks (when wired)     |
| `QSTASH_NEXT_SIGNING_KEY`    | Upstash                             | Key rotation safety net                     |

### 2.3 Audit (currently missing — confirmed via 500 on `/workflows/audit-outbox-drainer`)

| Var                           | Source                                                 | Purpose                      |
| ----------------------------- | ------------------------------------------------------ | ---------------------------- |
| `AUDIT_DATABASE_URL`          | Second Neon project `eleva_v3_audit` connection string | Append-only audit events     |
| `AUDIT_DATABASE_URL_UNPOOLED` | Same Neon project, direct (5432) connection            | Drainer transactional writes |

Without these the audit drainer returns `500 missing AUDIT_DATABASE_URL`
on every QStash run, which alerts your on-call and fills BetterStack
with noise.

### 2.4 Optional / phase-2

| Var                                     | When needed                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `WORKOS_SEAT_METER_ID`                  | Required for clinic-tier metered seat pricing (W5). Until set, clinic prices fall back to licensed seats |
| `BETTERSTACK_HEARTBEAT_URL`             | If you want the stripe-stuck-events heartbeat in BetterStack                                             |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | Already required by `/workos/sync` and rate limiting; verify still set                                   |

### 2.5 Verification

After setting and redeploying:

```bash
# Should return 200 with empty stuckCount; not 500.
curl -X POST https://api.eleva.care/workflows/audit-outbox-drainer \
  -H "Authorization: Bearer $WORKFLOWS_DRAIN_SECRET" -i

curl -X POST https://api.eleva.care/workflows/stripe-stuck-events \
  -H "Authorization: Bearer $WORKFLOWS_DRAIN_SECRET" -i
```

Both should return `200 OK`. A `500` with `missing AUDIT_DATABASE_URL`
means section 2.3 hasn't been done.

---

## 3 · Stripe Dashboard configuration

Run these against **live mode** (and again against any sandbox you
maintain for staging).

### 3.1 Webhook endpoint

The user already created `https://api.eleva.care/webhooks/stripe` in
the WorkOS Stripe-add-on dashboard. Re-run the setup script to make
sure it has the canonical 20-event list and an explicit
`api_version` pin (not "account default"):

```bash
pnpm --filter @eleva/infra-stripe setup:webhooks -- \
  --url https://api.eleva.care/webhooks/stripe --apply
```

The script:

- creates the endpoint if missing
- updates `enabled_events` to the canonical 20 if it exists
- pins `api_version` to whatever `STRIPE_API_VERSION` resolves to
- prints the new `whsec_…` secret on first creation — capture it
  immediately and update `STRIPE_WEBHOOK_SECRET` in section 2.1

If an existing endpoint has `api_version: null` (account default),
the script warns and tells you to recreate it. Do that — payload
shapes diverge across API versions and the SDK types only match the
pinned version.

### 3.2 Products + prices

```bash
pnpm --filter @eleva/infra-stripe seed:products
```

Idempotent. Creates the SaaS subscription products + tiered prices.
With `WORKOS_SEAT_METER_ID` set, clinic tiers get
`per_seat_metered` prices; without it they fall back to licensed.

### 3.3 Entitlements

```bash
pnpm --filter @eleva/infra-stripe seed:entitlements
```

Mirrors the `@eleva/flags` plan-feature matrix into Stripe Entitlements
so the WorkOS Stripe add-on can flow them to JWTs.

### 3.4 Verification

In Stripe Dashboard → Developers → Webhooks:

- Endpoint shows status `Enabled`
- API version matches `STRIPE_API_VERSION` (e.g. `2026-04-22.dahlia`)
- All 20 events listed under "Events sent"
- "Last delivered" updates after section 6's smoke trigger

---

## 4 · WorkOS ↔ Stripe customer linkage backfill

Every WorkOS Organization needs a `stripeCustomerId` mirror locally
and on the WorkOS org metadata. New orgs created via
`POST /organizations` get this automatically (we changed
`apps/api/src/app/organizations/route.ts` to call `provisionOrgBilling`).
Existing orgs need a one-shot backfill.

```bash
pnpm --filter @eleva/infra-stripe backfill:org-customers
```

Output is a summary of:

- `Already OK` — already linked, no work
- `Provisioned` — created Stripe customer + linked + mirrored
- `Mirrored only` — Stripe customer existed, only the local mirror missing
- `Orphan` — WorkOS org gone but local row remains (reconcile via `/workos/sync`, not here)
- `Failed` — investigate logs; usually a Stripe API issue

The script filters out soft-deleted orgs and gracefully handles
orphans, so it's safe to re-run.

### 4.1 Verify

```sql
SELECT
  COUNT(*) FILTER (WHERE stripe_customer_id IS NOT NULL) AS linked,
  COUNT(*) FILTER (WHERE stripe_customer_id IS NULL)     AS unlinked
FROM billing_customers;
```

`unlinked` should be 0 (or only equal to the orphan count from the
backfill output).

---

## 5 · QStash schedules

Two scheduled workflows must be registered. Both setup scripts are
idempotent (delete-then-recreate the schedule pointing at their
destination URL), so re-run any time.

### 5.1 Audit outbox drainer (twice daily)

```bash
API_BASE_URL=https://api.eleva.care \
  pnpm --filter @eleva/api setup:qstash:audit
```

Creates a schedule `0 6,18 * * *` (06:00 + 18:00 UTC) that POSTs to
`/workflows/audit-outbox-drainer` with the bearer token.

### 5.2 Stripe stuck-events detector (every 10 minutes)

```bash
API_BASE_URL=https://api.eleva.care \
  pnpm --filter @eleva/api setup:qstash:stripe-stuck
```

Creates a schedule `*/10 * * * *` that POSTs to
`/workflows/stripe-stuck-events`. Each invocation scans
`stripe_webhook_events` for rows past their threshold and fires a
Sentry `captureException` per stuck row.

### 5.3 Verify

In the [Upstash QStash console](https://console.upstash.com/qstash) →
**Schedules**: two entries pointing at the API. Logs tab shows each
invocation with `200 OK` response and the JSON body.

Then, in the API's runtime logs (Vercel → elevacare-api → Logs),
filter on `/workflows/` paths — you should see one POST to
`stripe-stuck-events` every 10 minutes and one to
`audit-outbox-drainer` at 06:00 + 18:00 UTC.

---

## 6 · Stripe end-to-end smoke (sandbox first, then live)

Run against staging/sandbox immediately after sections 1–5 are
green. Run again against live mode the moment you flip live traffic.

### 6.1 Subscription lifecycle

```bash
# Create
stripe trigger customer.subscription.created
# Update (e.g. tier change)
stripe trigger customer.subscription.updated
# Cancellation
stripe trigger customer.subscription.deleted
```

After each:

```sql
SELECT event_id, event_type, status, attempts, error
FROM stripe_webhook_events
ORDER BY received_at DESC
LIMIT 5;

SELECT id, status, current_period_end, last_event_created_at
FROM billing_subscriptions
ORDER BY updated_at DESC
LIMIT 5;
```

Expectations:

- new `stripe_webhook_events` row with `status = 'processed'` (or
  `'ignored'` with a clear `ignore_reason` for events the dispatcher
  intentionally skips)
- `billing_subscriptions` row reflects the latest state
- `last_event_created_at` advances monotonically (no stale events
  reverting newer state)
- `audit_outbox` has a matching row per mutation (drained twice daily
  to `audit_events` in the audit Neon project)

### 6.2 Invoice + payment

```bash
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
```

Verify `billing_invoice.paid` / `billing_invoice.payment_failed`
audit events appear.

### 6.3 Connect (expert payouts)

```bash
stripe trigger account.updated
stripe trigger payout.paid
stripe trigger payout.failed
```

`connect_account.capability_changed` and `connect_payout.succeeded`
/ `connect_payout.failed` audit events.

### 6.4 Identity (expert KYC)

```bash
stripe trigger identity.verification_session.verified
```

`identity_verification.verified` audit event; expert profile
`identity_status` flipped.

### 6.5 Booking PaymentIntents + disputes

```bash
stripe trigger payment_intent.succeeded
stripe trigger charge.refunded
stripe trigger charge.dispute.created
```

`booking_payment.succeeded`, `booking_payment.refunded`,
`booking_payment.disputed`.

### 6.6 Idempotency check

Replay any one event ID twice via the recovery tool:

```bash
pnpm --filter @eleva/infra-stripe replay:event evt_…
pnpm --filter @eleva/infra-stripe replay:event evt_…   # second run
```

Second run must NOT produce a duplicate audit row — the processor's
3-state state machine (`received → processing → processed`) should
short-circuit with `duplicate`. Verify via the audit table:

```sql
SELECT entity, action, COUNT(*)
FROM audit_events
WHERE payload->>'eventId' = 'evt_…'
GROUP BY entity, action;
```

Each (entity, action) pair must appear exactly once.

---

## 7 · Frontend smoke (after API is healthy)

### 7.1 OpenAPI spec

```bash
curl https://api.eleva.care/openapi.json | jq '.paths | keys'
```

Must list `/billing/subscribe`, `/stripe/identity`,
`/stripe/account-session`, `/webhooks/stripe`, plus the rest.

### 7.2 Subscribe flow (apps/account)

1. Sign in as a fresh user
2. Create an org (uses the new `provisionOrgBilling` path)
3. Pick a plan → embedded Checkout opens (per ADR-016)
4. Pay with `4242 4242 4242 4242`
5. Land back in app — JWT entitlements should reflect the new plan
   _immediately_ (no log-out / log-in cycle), thanks to
   `refreshSessionEntitlements()` in `/billing/subscribe`
6. Customer Portal link in account settings opens hosted Stripe portal

### 7.3 Connect onboarding (apps/expert)

1. Sign in as expert
2. Hit Connect onboarding → embedded AccountSession iframe loads
3. Complete one capability → webhook delivers `account.updated` →
   verify in `audit_events`

### 7.4 Identity (apps/expert)

1. Hit `/expert/onboarding/identity`
2. Verification iframe loads (Stripe Identity)
3. Submit test data → `identity.verification_session.verified` →
   profile flipped

---

## 8 · Observability

### 8.1 Sentry

In Sentry → elevacare-api project, after section 6:

- No new error issues from `/webhooks/stripe`
- No new errors from `/workflows/stripe-stuck-events` (other than
  intentional stuck-event alerts when something legitimately stalls)

### 8.2 BetterStack

If `BETTERSTACK_HEARTBEAT_URL` is set:

- A heartbeat fires every 10 min from `stripe-stuck-events`
- Heartbeat goes silent → BetterStack pages on-call

### 8.3 Manual stuck-event drill

Insert a synthetic stuck row to test the alert path end-to-end:

```sql
INSERT INTO stripe_webhook_events
  (event_id, event_type, livemode, status, received_at, last_attempt_at)
VALUES
  ('evt_drill_' || gen_random_uuid(), 'customer.subscription.updated',
   false, 'processing', now() - interval '20 minutes',
   now() - interval '15 minutes');
```

Wait 10 minutes — Sentry must show one new issue. Delete the synthetic
row afterward:

```sql
DELETE FROM stripe_webhook_events WHERE event_id LIKE 'evt_drill_%';
```

---

## 9 · Legacy cleanup

| Item                                     | Status                | Action                                                                                                    |
| ---------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| Old `/stripe/webhook` route              | Deleted in `b34c449`  | None — confirm 404 on the old path: `curl -i https://api.eleva.care/stripe/webhook -X POST` returns `404` |
| Old Stripe webhook endpoint in Dashboard | User reported deleted | Verify Stripe → Webhooks lists only `https://api.eleva.care/webhooks/stripe`                              |
| Stripe `Sandbox Eleva` webhook           | Local CLI only        | Leave alone — `stripe listen --forward-to localhost` covers local dev                                     |

---

## 10 · Rollback plan

If section 6 reveals a critical bug (events stuck `failed_terminal`,
audit not emitting, entitlements not flowing):

1. **Stop the bleed**: temporarily disable the webhook endpoint in
   Stripe Dashboard → Webhooks → toggle off. Stripe queues events
   for 3 days; you have time.
2. **Pause the QStash schedule** for `stripe-stuck-events` so on-call
   isn't paged on a known issue.
3. **Revert the merge**: `git revert -m 1 <merge-sha>` and ship.
   The new tables stay in place (zero impact on legacy code), but
   the new route stops processing and the old code path resumes.
4. Re-run section 6 in a sandbox to reproduce the bug, fix on a
   branch, re-merge.

The schema migrations are _purely additive_ — no data is lost on
revert. The new tables become unused, that's all.

---

## 11 · Done criteria

The integration is "live" when **all** of these are true:

- [ ] All 4 migrations applied + RLS on (section 1)
- [ ] All env vars in section 2 set in Vercel Production + redeployed
- [ ] Webhook endpoint pinned + 20 events + secret rotated into env (section 3)
- [ ] Org backfill summary shows 0 unexpected `Failed` (section 4)
- [ ] Both QStash schedules visible in console + firing on cadence (section 5)
- [ ] Each smoke event in section 6 ends in `processed` (or intentional `ignored`) with audit row
- [ ] Replay test in section 6.6 shows no duplicates
- [ ] Frontend flows in section 7 complete without errors
- [ ] Sentry shows no new issues from the cutover (section 8.1)
- [ ] Stuck-event drill in section 8.3 fires Sentry issue within 10 min
- [ ] Old `/stripe/webhook` returns 404, old Dashboard webhook removed (section 9)

When all 11 are checked, mark `ADR-016` as `Active` (currently
`Accepted`), and update `docs/eleva-v3/decision-log.md` with the
cutover date.

---

## Appendix · Quick reference

| Command                                                                   | What it does                              |
| ------------------------------------------------------------------------- | ----------------------------------------- |
| `pnpm --filter @eleva/db db:push`                                         | Apply Drizzle migrations                  |
| `pnpm --filter @eleva/db db:rls`                                          | Apply RLS policies                        |
| `pnpm --filter @eleva/db tsx scripts/fix-stripe-event-state-machine.ts`   | Idempotent recovery for partial migration |
| `pnpm --filter @eleva/infra-stripe setup:webhooks -- --url <url> --apply` | Configure Stripe webhook endpoint         |
| `pnpm --filter @eleva/infra-stripe seed:products`                         | Seed Stripe products + prices             |
| `pnpm --filter @eleva/infra-stripe seed:entitlements`                     | Seed Stripe Entitlements                  |
| `pnpm --filter @eleva/infra-stripe backfill:org-customers`                | Link existing orgs to Stripe customers    |
| `pnpm --filter @eleva/infra-stripe replay:event evt_…`                    | Re-run one event through the processor    |
| `pnpm --filter @eleva/api setup:qstash:audit`                             | Schedule audit drainer                    |
| `pnpm --filter @eleva/api setup:qstash:stripe-stuck`                      | Schedule stuck-event detector             |
| `stripe listen --forward-to localhost:3002/webhooks/stripe`               | Local dev tunnel                          |
| `stripe trigger <event>`                                                  | Fire a sample event                       |

| Env var                                                  | Where it must be set                | Owner                   |
| -------------------------------------------------------- | ----------------------------------- | ----------------------- |
| `STRIPE_SECRET_KEY`                                      | elevacare-api Production            | dev                     |
| `STRIPE_PUBLISHABLE_KEY`                                 | elevacare-api + elevacare-app       | dev                     |
| `STRIPE_WEBHOOK_SECRET`                                  | elevacare-api Production            | dev                     |
| `STRIPE_API_VERSION`                                     | elevacare-api Production            | dev                     |
| `STRIPE_CONNECT_CLIENT_ID`                               | elevacare-api Production            | dev                     |
| `WORKFLOWS_DRAIN_SECRET`                                 | elevacare-api Production            | dev                     |
| `QSTASH_TOKEN` / `QSTASH_URL`                            | elevacare-api Production            | dev                     |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | elevacare-api Production            | dev                     |
| `AUDIT_DATABASE_URL` / `AUDIT_DATABASE_URL_UNPOOLED`     | elevacare-api Production            | dev (currently MISSING) |
| `WORKOS_SEAT_METER_ID`                                   | elevacare-api Production (optional) | dev                     |
| `BETTERSTACK_HEARTBEAT_URL`                              | elevacare-api Production (optional) | ops                     |
