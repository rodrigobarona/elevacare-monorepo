# 09 — Workflows & Async Jobs

> Replacing **Upstash QStash crons** with the **Vercel Workflows SDK (WDK)**. Today there are 9 QStash schedules + 1 Vercel cron driving every async job in the platform; v2 turns each one into a typed, durable workflow that the Vercel platform manages, retries, and observes.

## What we built

### Cron inventory (current MVP)

From [config/qstash.ts](../../config/qstash.ts) and [vercel.json](../../vercel.json):

| Job                                | Schedule         | Endpoint                                    | Priority  | Purpose                                                                |
| ---------------------------------- | ---------------- | ------------------------------------------- | --------- | ---------------------------------------------------------------------- |
| `keep-alive` (Vercel cron)         | Daily            | `/api/cron/keep-alive`                      | -         | BetterStack heartbeat / system health.                                 |
| `appointmentReminders`             | `0 * * * *`      | `/api/cron/appointment-reminders`           | high      | 24-hour reminder per upcoming meeting (1-hour scan window).            |
| `appointmentReminders1Hr`          | `*/15 * * * *`   | `/api/cron/appointment-reminders-1hr`       | high      | 1-hour reminder per imminent meeting.                                  |
| `processExpertTransfers`           | `0 */2 * * *`    | `/api/cron/process-expert-transfers`        | critical  | Stripe transfer creation for approved payouts.                         |
| `processPendingPayouts`            | `0 6 * * *`      | `/api/cron/process-pending-payouts`         | high      | Daily: insert eligible meetings into `payment_transfers` queue.        |
| `checkUpcomingPayouts`             | `0 12 * * *`     | `/api/cron/check-upcoming-payouts`          | medium    | Notify experts about upcoming payouts.                                 |
| `sendPaymentReminders`             | `0 */6 * * *`    | `/api/cron/send-payment-reminders`          | high      | Multibanco D3/D6 reminders.                                            |
| `cleanupExpiredReservations`       | `*/15 * * * *`   | `/api/cron/cleanup-expired-reservations`    | medium    | Drop expired `slot_reservations` and pending payments.                 |
| `cleanupBlockedDates`              | `0 0 * * *`      | `/api/cron/cleanup-blocked-dates`           | low       | Remove old blocked dates / past calendar conflicts.                    |
| `processTasks`                     | `0 4 * * *`      | `/api/cron/process-tasks`                   | medium    | General system maintenance + audit log compaction.                     |

### Architecture today

- All schedules registered via a setup script that calls QStash's API.
- QStash signs requests with `QSTASH_CURRENT_SIGNING_KEY`; the `/api/qstash` route verifies.
- The `/api/cron/*` endpoints additionally guard with `CRON_SECRET` from header.
- BetterStack heartbeats fire from each successful run.
- Failures alert via Novu (per `qstash.monitoring.alerting`).

### Why QStash

- "Don't run a worker" — QStash hosts the schedules.
- Webhook-style invocation mapped naturally to Next.js API routes.
- Signed requests so anyone can't trigger a cron URL.

## What worked

- Single config file made schedules visible.
- BetterStack heartbeat per cron gave deliverability monitoring.
- QStash retries handled transient failures.

## What didn't

| Issue                                 | Detail                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Silent schedule loss**              | If the QStash setup script wasn't re-run after env changes, schedules silently went to **0 firings**. Multibanco completion rates dropped with no alert.       |
| **Polling-based reminders**           | `appointmentReminders1Hr` runs every 15 minutes scanning the DB for meetings 60 minutes out. It's a polling implementation of "wake me at time T". Fragile on DB load. |
| **No tests**                          | Cron handlers have **zero** unit/integration tests. They are the load-bearing async runtime and they are unverified.                                          |
| **Two scheduling systems**            | QStash for most things + Vercel cron for `keep-alive`. Conceptual overhead with no operational benefit.                                                      |
| **No DAG / no step semantics**        | Each cron is one HTTP call. Multi-step orchestration (e.g., payout pipeline = eligibility → admin queue → transfer → confirmation) is implicit across crons. |
| **No idempotency layer**              | Retries can double-send reminders if handlers don't check the DB. Some do, some don't.                                                                       |
| **Per-job not per-event**             | "Send Multibanco D3 reminder" should be triggered when a Multibanco voucher is created — not by polling every 6 hours.                                      |
| **Hostile DX**                        | Adding a new schedule requires editing config, running a setup script, hoping QStash registers, manually verifying.                                          |

## v2 prescription

### Replace QStash with Vercel Workflows SDK (WDK)

Vercel Workflows provides:

- **Durable execution** — workflows survive crashes, deploys, restarts.
- **Step semantics** (`step.run`, `step.sleep`, `step.condition`).
- **Native idempotency** — each step is keyed and replay-safe.
- **Per-event triggers** — workflows are triggered by events, not polling.
- **Built-in observability** — Vercel dashboard shows step state.
- **Same hosting** — no separate worker, no external scheduler.

Reference: the `vercel-workflows-sdk` skill in this repo.

### Workflow inventory (v2)

| Workflow                          | Triggered by                                                | Replaces                                          |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| `bookingConfirmation`             | Stripe `payment_intent.succeeded`                            | `appointment-confirmation` Novu workflow          |
| `appointmentReminder24h`          | Workflow step in `bookingConfirmation` (sleep until T-24h)   | `appointmentReminders` cron                       |
| `appointmentReminder1h`           | Workflow step in `bookingConfirmation` (sleep until T-1h)    | `appointmentReminders1Hr` cron                    |
| `noShowFollowup`                  | Workflow step in `bookingConfirmation` (sleep until T+1h)    | (new — was missing in MVP)                        |
| `multibancoReminders`             | Stripe `payment_intent.processing` (Multibanco voucher)      | `sendPaymentReminders` cron + Novu workflows      |
| `multibancoExpiry`                | Workflow step in `multibancoReminders` (sleep until expiry)  | (replaces polling for voucher expiry)             |
| `payoutEligibility`               | Workflow step in `bookingConfirmation` (sleep meeting + delay) | `processPendingPayouts` cron                    |
| `payoutApprovalReminder`          | Workflow step (daily until approved)                         | (new — admin nudges)                              |
| `payoutTransfer`                  | Admin approval action                                        | `processExpertTransfers` cron                     |
| `expertOnboardingNudge`           | WorkOS `user.created` (org_type=expert)                      | (new — was missing)                               |
| `expertSubscriptionLifecycle`     | Stripe `customer.subscription.*`                              | (new — supports v2 subscriptions)                 |
| `reservationExpiry`               | Reservation creation (sleep TTL)                              | `cleanupExpiredReservations` cron                 |
| `cleanupBlockedDates`             | Vercel cron (true periodic)                                   | `cleanupBlockedDates` cron                        |
| `dataRetentionPurge`              | Vercel cron (daily)                                           | `processTasks` cron                               |
| `audit logCompaction`             | Vercel cron (weekly)                                          | (new — explicit ownership)                        |
| `systemHealth`                    | Vercel cron (5 min)                                           | `keep-alive` Vercel cron                          |

### Pattern: `bookingConfirmation` workflow

```ts
// packages/workflows/bookingConfirmation.ts
import { workflow } from '@vercel/workflows';

type Input = {
  meetingId: string;
  paymentIntentId: string;
};

export const bookingConfirmation = workflow<Input>('booking-confirmation', async ({ step, sleep, input }) => {
  const meeting = await step.run('load-meeting', () => loadMeeting(input.meetingId));
  if (!meeting) return; // soft-deleted — terminate

  await step.run('send-confirmation-email', () =>
    sendTransactional({
      template: 'booking-confirmation',
      to: meeting.guestEmail,
      locale: meeting.locale,
      data: meetingToEmailPayload(meeting),
      idempotencyKey: `${input.paymentIntentId}-confirmation`,
    }),
  );

  await step.run('create-calendar-event', () => createCalendarEventIdempotent({ meeting }));

  // 24-hour reminder
  await sleep('until-24h-before', addMinutes(meeting.startTime, -1440));
  if (await step.run('still-confirmed', () => isStillConfirmed(meeting.id))) {
    await step.run('send-24h-reminder', () =>
      sendTransactional({
        template: 'appointment-reminder',
        to: meeting.guestEmail,
        data: { ...meetingToEmailPayload(meeting), windowHours: 24 },
        idempotencyKey: `${meeting.id}-reminder-24h`,
      }),
    );
  }

  // 1-hour reminder
  await sleep('until-1h-before', addMinutes(meeting.startTime, -60));
  if (await step.run('still-confirmed-2', () => isStillConfirmed(meeting.id))) {
    await step.run('send-1h-reminder', () =>
      sendTransactional({
        template: 'appointment-reminder',
        to: meeting.guestEmail,
        data: { ...meetingToEmailPayload(meeting), windowHours: 1 },
        idempotencyKey: `${meeting.id}-reminder-1h`,
      }),
    );
  }

  // After session: schedule payout eligibility
  await sleep('until-end', meeting.endTime);
  await step.run('schedule-payout-eligibility', () =>
    triggerWorkflow(payoutEligibility, { meetingId: meeting.id }),
  );

  // After session + 24h: ask for review (optional)
  await sleep('until-followup', addHours(meeting.endTime, 24));
  await step.run('send-followup', () =>
    sendTransactional({
      template: 'session-followup',
      to: meeting.guestEmail,
      data: meetingToEmailPayload(meeting),
      idempotencyKey: `${meeting.id}-followup`,
    }),
  );
});
```

Triggered from the Stripe webhook handler:

```ts
// app/api/stripe/webhook/route.ts
case 'payment_intent.succeeded': {
  // ... persist meeting, payment_transfers ...
  await triggerWorkflow(bookingConfirmation, {
    meetingId: meeting.id,
    paymentIntentId: event.data.object.id,
  });
}
```

### Pattern: `multibancoReminders` workflow

```ts
export const multibancoReminders = workflow<{ paymentIntentId: string }>('multibanco-reminders', async ({ step, sleep, input }) => {
  const intent = await step.run('load-intent', () => loadPaymentIntent(input.paymentIntentId));
  if (intent.status === 'succeeded') return;

  await sleep('to-d3', addDays(intent.created, 5));     // 8d voucher TTL - 3d
  if (await step.run('check-d3-status', () => isStillPending(intent.id))) {
    await step.run('send-d3', () => sendTransactional({
      template: 'multibanco-reminder',
      to: intent.metadata.guestEmail,
      data: { intent, daysLeft: 3 },
      idempotencyKey: `${intent.id}-mb-d3`,
    }));
  }

  await sleep('to-d6', addDays(intent.created, 7));
  if (await step.run('check-d6-status', () => isStillPending(intent.id))) {
    await step.run('send-d6', () => sendTransactional({
      template: 'multibanco-reminder',
      to: intent.metadata.guestEmail,
      data: { intent, daysLeft: 1 },
      idempotencyKey: `${intent.id}-mb-d6`,
    }));
  }
});
```

The workflow short-circuits as soon as a status check shows `succeeded` or `payment_failed` — no need for a separate cancellation message because each step rechecks state.

### Pattern: `payoutEligibility` → `payoutApprovalReminder` → `payoutTransfer`

Three separate workflows for clean ownership:

1. `payoutEligibility(meetingId)` — sleeps until meeting + country payout delay; inserts `payment_transfers` row in `pending_admin_approval`; triggers `payoutApprovalReminder`.
2. `payoutApprovalReminder(transferId)` — daily nudge to admin until status changes.
3. `payoutTransfer(transferId)` — triggered by admin approval action; calls `stripe.transfers.create` with retries; updates row to `completed`.

### Truly periodic jobs stay on Vercel cron

Some jobs are inherently periodic (no triggering event):

- `cleanupBlockedDates` — daily.
- `dataRetentionPurge` — daily.
- `auditLogCompaction` — weekly.
- `systemHealth` — every 5 min (BetterStack heartbeat).

These remain Vercel cron jobs in `vercel.ts` (the v2 config replacement for `vercel.json`):

```ts
// vercel.ts
export const config: VercelConfig = {
  crons: [
    { path: '/api/cron/system-health', schedule: '*/5 * * * *' },
    { path: '/api/cron/cleanup-blocked-dates', schedule: '0 0 * * *' },
    { path: '/api/cron/data-retention-purge', schedule: '0 4 * * *' },
    { path: '/api/cron/audit-log-compaction', schedule: '0 5 * * 0' },
  ],
};
```

These cron handlers invoke `triggerWorkflow()` so the actual work still runs in the workflow runtime with all its observability and retry machinery.

### Idempotency

WDK steps are idempotent by step ID + workflow run ID. Side-effecting calls (Resend send, Stripe transfer create) **also** use a stable idempotency key derived from the workflow input + step ID. Belt and braces.

### Observability

- Workflow step results surface in the Vercel dashboard.
- Sentry receives errors with workflow + step tag.
- BetterStack receives heartbeats from `systemHealth` cron.
- Resend dashboard shows email deliverability per template.

### Tests

Each workflow ships with a Vitest test that mocks step results and asserts:

- Happy path triggers all expected steps.
- Cancellation paths short-circuit.
- Idempotency keys are stable across replays.

## Concrete checklist for the new repo

- [ ] `packages/workflows/` exposes one workflow per row in the v2 inventory.
- [ ] Stripe webhook handler triggers `bookingConfirmation` and `multibancoReminders` directly — no QStash schedule registration.
- [ ] WorkOS webhook handler triggers `expertOnboardingNudge` for new expert orgs.
- [ ] Subscription Stripe events trigger `expertSubscriptionLifecycle`.
- [ ] Truly periodic jobs (`cleanupBlockedDates`, `dataRetentionPurge`, `auditLogCompaction`, `systemHealth`) live in `vercel.ts` cron config and trigger workflows.
- [ ] No QStash dependency in `package.json` or `.env*`.
- [ ] No `app/api/qstash/route.ts`.
- [ ] No `app/api/cron/*` polling endpoints (those that remain are thin triggers for workflows).
- [ ] Vitest covers each workflow's happy path, idempotency, and cancellation.
- [ ] Sentry tags every step with `workflow:name` and `step:id`.
- [ ] All side-effecting step calls (`sendTransactional`, `stripe.transfers.create`, `calendar.events.insert`) carry a stable idempotency key.
- [ ] BetterStack heartbeat cron exists and is alerting if missing for > 10 min.
