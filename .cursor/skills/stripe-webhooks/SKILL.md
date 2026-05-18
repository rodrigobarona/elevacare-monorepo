# Stripe Webhooks — Add, Remove, or Update Events

Manage the Stripe webhook event lifecycle: handler dispatch + endpoint
configuration. Use when adding new Stripe webhook events, removing
existing ones, updating handler logic, or setting up the webhook endpoint
for a new environment.

## When to Use

- Adding a new Stripe event (e.g. `payment_intent.canceled`) to the dispatcher
- Removing an event the dispatcher no longer needs
- Modifying how an existing event is processed
- Setting up the webhook endpoint for staging/production
- Debugging webhook delivery, signature verification, or idempotency
- Reviewing webhook code for completeness

## Architecture

The webhook surface follows a **two-file contract**:

| File                                        | Purpose                                                             |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `packages/billing/src/server/webhook.ts`    | `processStripeEvent` core — dispatch switch, idempotency, withAudit |
| `infra/stripe/setup-webhooks.ts`            | Endpoint config script — `WEBHOOK_EVENTS` array                     |
| `apps/api/src/app/webhooks/stripe/route.ts` | Thin route — signature verify, call processor, map result code      |
| `infra/stripe/README.md`                    | Operational docs                                                    |
| `.cursor/rules/stripe-webhooks.mdc`         | Auto-triggered rule for these files                                 |

**Idempotency.** Every event is recorded in the `stripe_webhook_events` DB
table keyed by Stripe `event.id` before dispatch. Duplicate deliveries are
short-circuited with `INSERT ... ON CONFLICT DO NOTHING` and the route
returns `200 { received: true, status: "duplicate" }`.

**Audit.** Every domain mirror update inside a handler is wrapped in
`withAudit({ orgId, actorUserId: null })` from `@eleva/audit`. The
`actorUserId: null` denotes a system actor; the multi-admin attribution
pattern in ADR-016 correlates audited Portal session-mints with these
events to infer the actor.

## Step-by-Step: Adding a New Event

### Step 1: Extend the audit unions if needed

If the new event needs a new `entity` or `action` value, add it to the
closed unions in `packages/audit/src/types.ts` first.

### Step 2: Add the dispatcher case

Open `packages/billing/src/server/webhook.ts` and add a `case` branch in
the `dispatchEvent` function's `switch`:

```typescript
case "payment_intent.canceled":
  return handlePaymentIntentCanceled(event)
```

Then implement the handler. Each handler must:

- resolve the tenant `orgId` (via `resolveOrgIdFromCustomer`,
  `resolveOrgIdFromConnectAccount`, or `orgIdFromMetadata`),
- return `{ kind: "ignored", reason, resolvedOrgId: null }` when the
  event has no resolvable tenant (Stripe must NOT retry — these are
  valid events the system chose not to act on),
- wrap mirror writes in `withAudit({ orgId, actorUserId: null })` and
  emit a closed-union `entity` + `action`.

### Step 3: Add the event to the setup script

Open `infra/stripe/setup-webhooks.ts` and add the event to
`WEBHOOK_EVENTS`. Keep the comments grouped by domain (SaaS lifecycle,
Identity, Connect platform, payouts, booking, refunds/disputes).

### Step 4: Update the live endpoint

```bash
# Dry-run first
pnpm stripe:setup:webhooks -- --url https://api.eleva.care/webhooks/stripe

# Apply
pnpm stripe:setup:webhooks -- --url https://api.eleva.care/webhooks/stripe --apply
```

The script is idempotent: it finds the existing endpoint by URL and
updates its `enabled_events` list. No new signing secret is generated on
update.

### Step 5: Update documentation

Update the "Current canonical events" list in
`.cursor/rules/stripe-webhooks.mdc` and the events list in
`infra/stripe/README.md`.

## Step-by-Step: Removing an Event

1. Remove the `case` branch from `dispatchEvent` and the handler function.
2. Remove the event from `WEBHOOK_EVENTS` in `setup-webhooks.ts`.
3. Re-run the setup script with `--apply`.
4. Update the docs (rule file + README).

## Setup for a New Environment

```bash
# Creates the endpoint and prints the signing secret
pnpm stripe:setup:webhooks -- --url https://<api-domain>/webhooks/stripe --apply
```

Save the `whsec_...` secret as `STRIPE_WEBHOOK_SECRET` in the environment.
The secret is only shown once at creation time.

**WorkOS Stripe Add-on note:** The Add-on does NOT support Stripe Sandbox
accounts (per ADR-016). For staging/dev, use Stripe **test mode** on a
standard account, not a Sandbox account.

## Local Development

Use the Stripe CLI to forward events to the local API (port 3002). Do
**not** run `setup-webhooks.ts` for localhost.

### First-time setup

1. Install: `brew install stripe/stripe-cli/stripe`
2. Log in: `stripe login`
3. Start the listener:

   ```bash
   stripe listen --forward-to localhost:3002/webhooks/stripe
   ```

4. Copy the `whsec_...` from the CLI output into `.env.local`:

   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. Restart the API dev server so it picks up the new secret.

### Daily workflow

```bash
# Terminal 1 — API
pnpm --filter @eleva/api dev

# Terminal 2 — Stripe event forwarding
stripe listen --forward-to localhost:3002/webhooks/stripe
```

### Triggering test events

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.paid
stripe trigger payment_intent.succeeded
stripe trigger payout.paid
stripe trigger account.updated
stripe trigger identity.verification_session.verified
```

Check the API logs for `[stripe-webhook]` output and the
`stripe_webhook_events` table for persisted entries.

## Verification Checklist

After any change, confirm:

- [ ] Every event in `WEBHOOK_EVENTS` has a matching `case` in `dispatchEvent`
- [ ] Every `case` in `dispatchEvent` is listed in `WEBHOOK_EVENTS`
- [ ] The route handler verifies signatures via `stripe().webhooks.constructEventAsync()`
- [ ] Unrecognized events fall through to the `default` branch and return `{ kind: "ignored" }` (route returns 200)
- [ ] All mirror writes are wrapped in `withAudit` with the resolved `orgId`
- [ ] Any new audit `entity` / `action` strings are added to `packages/audit/src/types.ts`
- [ ] The setup script was re-run with `--apply` against the target environment
- [ ] `.cursor/rules/stripe-webhooks.mdc` event list is up to date
- [ ] `infra/stripe/README.md` event list is up to date
