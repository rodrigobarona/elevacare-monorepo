# Stripe Webhooks — Add, Remove, or Update Events

Manage the Stripe webhook event lifecycle: handler code + endpoint configuration.
Use when adding new Stripe webhook events, removing existing ones, updating
handler logic, or setting up the webhook endpoint for a new environment.

## When to Use

- Adding a new Stripe event (e.g. `checkout.session.completed`) to the handler
- Removing an event the handler no longer needs
- Modifying how an existing event is processed
- Setting up the webhook endpoint for staging/production
- Debugging webhook delivery or signature verification failures
- Reviewing webhook code for completeness

## Key Files

| File                                       | Purpose                                         |
| ------------------------------------------ | ----------------------------------------------- |
| `apps/api/src/app/stripe/webhook/route.ts` | Runtime handler — `POST /stripe/webhook`        |
| `infra/stripe/setup-webhooks.ts`           | Endpoint config script — `WEBHOOK_EVENTS` array |
| `infra/stripe/README.md`                   | Docs: events, usage, production checklist       |
| `.cursor/rules/stripe-webhooks.mdc`        | Auto-triggered rule for these files             |

## Step-by-Step: Adding a New Event

### Step 1: Add the handler case

Open `apps/api/src/app/stripe/webhook/route.ts` and add a `case` branch in
the `handleEvent` function's `switch` statement:

```typescript
case "checkout.session.completed":
  await handleCheckoutCompleted(obj)
  break
```

Then implement the handler function in the same file, following the existing
pattern (extract fields from `obj`, log structured info, perform business logic).

### Step 2: Add the event to the setup script

Open `infra/stripe/setup-webhooks.ts` and add the event string to the
`WEBHOOK_EVENTS` array:

```typescript
const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "checkout.session.completed", // <-- new
]
```

### Step 3: Update the live endpoint

Run the setup script to sync the endpoint's subscribed events:

```bash
# Dry-run first
pnpm stripe:setup:webhooks -- --url https://api.eleva.care/stripe/webhook

# Apply
pnpm stripe:setup:webhooks -- --url https://api.eleva.care/stripe/webhook --apply
```

The script is idempotent: it finds the existing endpoint by URL and updates
its `enabled_events` list. No new signing secret is generated on update.

### Step 4: Update documentation

Update the "Current events" list in `.cursor/rules/stripe-webhooks.mdc` and
the webhook handler's JSDoc comment in `route.ts`.

## Step-by-Step: Removing an Event

1. Remove the `case` branch from `handleEvent` in `route.ts`.
2. Remove the event from `WEBHOOK_EVENTS` in `setup-webhooks.ts`.
3. Re-run the setup script with `--apply`.
4. Update the docs (rule file + route JSDoc).

## Setup for a New Environment

```bash
# Creates the endpoint and prints the signing secret
pnpm stripe:setup:webhooks -- --url https://<api-domain>/stripe/webhook --apply
```

Save the `whsec_...` secret as `STRIPE_WEBHOOK_SECRET` in the environment.
The secret is only shown once at creation time.

## Local Development

Use the Stripe CLI to forward events to the local API (port 3002). Do **not**
run `setup-webhooks.ts` for localhost.

### First-time setup

1. Install: `brew install stripe/stripe-cli/stripe`
2. Log in: `stripe login`
3. Start the listener:

   ```bash
   stripe listen --forward-to localhost:3002/stripe/webhook
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
stripe listen --forward-to localhost:3002/stripe/webhook
```

### Triggering test events

```bash
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

Check the API logs for `[stripe-webhook]` output.

## Verification Checklist

After any change, confirm:

- [ ] Every event in `WEBHOOK_EVENTS` has a matching `case` in the handler
- [ ] Every `case` in the handler is listed in `WEBHOOK_EVENTS`
- [ ] The handler verifies signatures via `stripe().webhooks.constructEvent()`
- [ ] Unrecognized events fall through `default: break` (return 200, no retry)
- [ ] The setup script was re-run with `--apply` against the target environment
- [ ] `.cursor/rules/stripe-webhooks.mdc` event list is up to date
- [ ] Route JSDoc "Handled events" comment is up to date
