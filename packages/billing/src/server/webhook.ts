import { and, eq } from "drizzle-orm"
import type Stripe from "stripe"
import { withAudit } from "@eleva/audit"
import { main, withPlatformAdminContext, type Tx } from "@eleva/db"

/**
 * Stripe webhook processor (Phase 1 of stripe-foundation-review).
 *
 * Single entrypoint: `processStripeEvent(event)`.
 *
 * Responsibilities:
 *
 *   1. Idempotency. Insert the Stripe `event.id` into
 *      `stripe_webhook_events` with status='received'. ON CONFLICT DO
 *      NOTHING — if we lose the race, another delivery already ran the
 *      handler. We return `{ status: "duplicate" }` and the route
 *      responds 200 to Stripe (do not retry).
 *
 *   2. Dispatch by event.type. Each branch resolves the tenant `orgId`
 *      from event metadata / customer / connected account, then writes
 *      its mirror under `withAudit({ orgId, actorUserId: null })`.
 *      `actorUserId: null` indicates a system actor; the multi-admin
 *      attribution pattern in ADR-016 correlates the audited Portal
 *      session-mint with these events for actor inference.
 *
 *   3. Result reporting. Update `stripe_webhook_events.status` to
 *      `processed` (with `processed_at`) on success, `failed` (with
 *      truncated error) on retryable failure, or `ignored` for events
 *      the dispatcher recognizes as "valid but no action".
 *
 * The processor MUST NOT throw to its caller for "valid but unhandled"
 * events — Stripe should NOT retry those. It throws only for truly
 * retryable errors (DB outage, transient WorkOS failure) so the route
 * can return non-2xx and let Stripe redeliver.
 */

const ERROR_TRUNCATE_LENGTH = 2000

export type StripeEventResult =
  | { status: "duplicate"; eventId: string }
  | { status: "processed"; eventId: string; eventType: string }
  | { status: "ignored"; eventId: string; eventType: string; reason: string }
  | {
      status: "failed"
      eventId: string
      eventType: string
      error: string
    }

interface IgnoredOutcome {
  kind: "ignored"
  reason: string
  resolvedOrgId: string | null
}
interface HandledOutcome {
  kind: "handled"
  resolvedOrgId: string | null
}
type DispatchResult = IgnoredOutcome | HandledOutcome

export async function processStripeEvent(
  event: Stripe.Event
): Promise<StripeEventResult> {
  const inserted = await tryInsertEventLog(event)
  if (!inserted) {
    return { status: "duplicate", eventId: event.id }
  }

  try {
    const dispatch = await dispatchEvent(event)
    await markProcessed(event.id, dispatch.resolvedOrgId)
    if (dispatch.kind === "ignored") {
      return {
        status: "ignored",
        eventId: event.id,
        eventType: event.type,
        reason: dispatch.reason,
      }
    }
    return {
      status: "processed",
      eventId: event.id,
      eventType: event.type,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown handler error"
    await markFailed(event.id, message)
    return {
      status: "failed",
      eventId: event.id,
      eventType: event.type,
      error: message,
    }
  }
}

type DispatchOutcome = DispatchResult

async function dispatchEvent(event: Stripe.Event): Promise<DispatchOutcome> {
  switch (event.type) {
    // SaaS subscription lifecycle.
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscriptionEvent(event)

    // Initial purchase via Embedded Checkout (ADR-016).
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(event)

    // Invoice lifecycle (back-compat: keep payment_succeeded mapping
    // alongside the new `paid` event until Stripe stops sending the
    // legacy event for current API versions).
    case "invoice.paid":
    case "invoice.payment_succeeded":
      return handleInvoicePaid(event)
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event)
    case "invoice.payment_action_required":
      return handleInvoiceRequiresAction(event)

    // Stripe Identity (expert KYC).
    case "identity.verification_session.verified":
    case "identity.verification_session.requires_input":
    case "identity.verification_session.canceled":
      return handleIdentityEvent(event)

    // Connect platform (account status, capabilities, deauthorization).
    case "account.updated":
      return handleAccountUpdated(event)
    case "capability.updated":
      return handleCapabilityUpdated(event)
    case "account.application.deauthorized":
      return handleAccountDeauthorized(event)

    // Connect payouts.
    case "payout.paid":
    case "payout.failed":
      return handlePayoutEvent(event)

    // Booking PaymentIntents (patient checkout).
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
      return handlePaymentIntentEvent(event)

    // Refunds and disputes (booking payments).
    case "charge.refunded":
      return handleChargeRefunded(event)
    case "charge.dispute.created":
      return handleChargeDisputeCreated(event)

    default:
      return {
        kind: "ignored",
        reason: "no handler registered for event type",
        resolvedOrgId: null,
      }
  }
}

// =============================================================================
// Idempotency: insert / update stripe_webhook_events
// =============================================================================

/**
 * Insert the event into `stripe_webhook_events` with status='received'.
 * Returns true when this delivery won the race; false on duplicate.
 *
 * Runs under platform-admin context because this table is platform-level
 * (not tenant-scoped) and pre-dates org resolution.
 */
async function tryInsertEventLog(event: Stripe.Event): Promise<boolean> {
  const result = await withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .insert(main.stripeWebhookEvents)
      .values({
        eventId: event.id,
        eventType: event.type,
        livemode: event.livemode,
        apiVersion: event.api_version,
        eventCreatedAt: new Date(event.created * 1000),
        status: "received",
      })
      .onConflictDoNothing({ target: main.stripeWebhookEvents.eventId })
      .returning({ eventId: main.stripeWebhookEvents.eventId })
    return rows
  })
  return result.length > 0
}

async function markProcessed(
  eventId: string,
  resolvedOrgId?: string | null
): Promise<void> {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.stripeWebhookEvents)
      .set({
        status: "processed",
        processedAt: new Date(),
        resolvedOrgId: resolvedOrgId ?? null,
      })
      .where(eq(main.stripeWebhookEvents.eventId, eventId))
  })
}

async function markFailed(eventId: string, error: string): Promise<void> {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.stripeWebhookEvents)
      .set({
        status: "failed",
        error: error.slice(0, ERROR_TRUNCATE_LENGTH),
      })
      .where(eq(main.stripeWebhookEvents.eventId, eventId))
  })
}

// =============================================================================
// Tenant resolution helpers
// =============================================================================

/**
 * Resolve org_id for a Stripe Customer ID. Strategy:
 *   1. Look it up in `billing_customers` (mirror) under platform-admin
 *      context.
 *   2. If absent, return null. Caller decides whether to backfill from
 *      Stripe metadata or skip the event.
 */
async function resolveOrgIdFromCustomer(
  stripeCustomerId: string
): Promise<string | null> {
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({ orgId: main.billingCustomers.orgId })
      .from(main.billingCustomers)
      .where(eq(main.billingCustomers.stripeCustomerId, stripeCustomerId))
      .limit(1)
    return rows[0]?.orgId ?? null
  })
}

/**
 * Resolve org_id for a Stripe connected account ID by joining through
 * expert_profiles.stripe_account_id. Returns null if no expert is linked.
 */
async function resolveOrgIdFromConnectAccount(
  stripeAccountId: string
): Promise<{ orgId: string; expertProfileId: string } | null> {
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        orgId: main.expertProfiles.orgId,
        expertProfileId: main.expertProfiles.id,
      })
      .from(main.expertProfiles)
      .where(eq(main.expertProfiles.stripeAccountId, stripeAccountId))
      .limit(1)
    return rows[0] ?? null
  })
}

/**
 * Read `eleva_org_id` from Stripe metadata. Returns null if missing or
 * not a UUID-looking string. Called as a fallback when the mirror lookup
 * misses (e.g., the customer was created before the mirror table existed
 * or by an external process).
 */
function orgIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): string | null {
  if (!metadata) return null
  const value = metadata["eleva_org_id"]
  if (typeof value !== "string" || value.length < 36) return null
  return value
}

function tierFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): string {
  if (!metadata) return "unknown"
  const tier = metadata["eleva_tier"]
  return typeof tier === "string" && tier.length > 0 ? tier : "unknown"
}

/**
 * Extract the subscription id from an Invoice. In Stripe API >= 2025
 * `invoice.subscription` was removed in favor of
 * `invoice.parent.subscription_details.subscription`, which can be a
 * string id or an expanded Subscription object.
 */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription ?? null
  if (!sub) return null
  return typeof sub === "string" ? sub : sub.id
}

// =============================================================================
// Subscription lifecycle handlers
// =============================================================================

async function handleSubscriptionEvent(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const subscription = event.data.object as Stripe.Subscription
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  const orgId =
    (await resolveOrgIdFromCustomer(customerId)) ??
    orgIdFromMetadata(subscription.metadata)

  if (!orgId) {
    // Mirror not yet seeded for this customer and metadata is missing.
    // Log via stripe_webhook_events.error and return ignored so Stripe
    // doesn't retry. Operators can replay once the mirror catches up.
    return {
      kind: "ignored",
      reason: `no org resolution for customer ${customerId}`,
      resolvedOrgId: null,
    }
  }

  const tier = tierFromMetadata(subscription.metadata)
  const status =
    subscription.status as (typeof main.stripeSubscriptionStatusEnum.enumValues)[number]
  const action = mapSubscriptionAction(event.type, status)

  await withAudit({ orgId, actorUserId: null }, async (tx, ctx) => {
    await upsertSubscriptionMirror(tx, {
      orgId,
      subscription,
      tier,
      status,
      customerId,
    })

    // Mirror Top Expert active flag onto expert_profiles for fast
    // commission lookups. The flag is only meaningful for expert orgs;
    // updateMany is a no-op when no expert profile exists for this org.
    if (tier === "expert_top") {
      await tx
        .update(main.expertProfiles)
        .set({
          topExpertActive: status === "active" || status === "trialing",
          updatedAt: new Date(),
        })
        .where(eq(main.expertProfiles.orgId, orgId))
    }

    await ctx.emit({
      entity: "billing_subscription",
      action,
      entityId: subscription.id,
      payload: {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        tier,
        status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd:
          subscription.items.data[0]?.current_period_end ?? null,
      },
    })
  })

  return { kind: "handled", resolvedOrgId: orgId }
}

function mapSubscriptionAction(
  eventType: string,
  status: string
): "created" | "updated" | "canceled" | "reactivated" | "past_due_recovered" {
  if (eventType === "customer.subscription.created") return "created"
  if (eventType === "customer.subscription.deleted") return "canceled"
  // updated: distinguish reactivation / past_due recovery if useful
  if (status === "active") return "updated"
  return "updated"
}

async function upsertSubscriptionMirror(
  tx: Tx,
  input: {
    orgId: string
    subscription: Stripe.Subscription
    tier: string
    status: (typeof main.stripeSubscriptionStatusEnum.enumValues)[number]
    customerId: string
  }
): Promise<void> {
  const { orgId, subscription, tier, status, customerId } = input
  const priceIds = subscription.items.data.map((item) => item.price.id)
  const seatItemId =
    subscription.items.data.find(
      (item) =>
        item.price.metadata?.eleva_price_type === "per_seat" ||
        item.price.recurring?.usage_type === "metered"
    )?.id ?? null

  // In Stripe API >= 2024-12, current_period_* moved from the
  // top-level Subscription onto each SubscriptionItem. Within a single
  // Eleva subscription all items share the same anchor, so reading from
  // the first item is correct.
  const firstItem = subscription.items.data[0]
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000)
    : null
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : null
  const canceledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000)
    : null

  await tx
    .insert(main.billingSubscriptions)
    .values({
      orgId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      tier,
      status,
      priceIds,
      seatItemId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt,
      metadata: subscription.metadata as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: main.billingSubscriptions.stripeSubscriptionId,
      set: {
        status,
        tier,
        priceIds,
        seatItemId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt,
        metadata: subscription.metadata as Record<string, unknown>,
        updatedAt: new Date(),
      },
    })
}

// =============================================================================
// Checkout / invoice handlers
// =============================================================================

async function handleCheckoutSessionCompleted(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const session = event.data.object as Stripe.Checkout.Session
  // Subscription mode is the relevant case; one-off mode is handled by
  // the booking PaymentIntent path. For subscription mode the full
  // subscription state is already being delivered as
  // customer.subscription.created / .updated, so this handler logs
  // attribution context (client_reference_id, customer, mode) and
  // returns. Top Expert / clinic SaaS state is mirrored via subscription
  // events.
  if (session.mode !== "subscription") {
    return {
      kind: "ignored",
      reason: "checkout.session.completed in non-subscription mode",
      resolvedOrgId: null,
    }
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null)
  const orgId = customerId
    ? ((await resolveOrgIdFromCustomer(customerId)) ??
      orgIdFromMetadata(session.metadata))
    : orgIdFromMetadata(session.metadata)

  if (!orgId) {
    return {
      kind: "ignored",
      reason: "no org resolution from checkout session",
      resolvedOrgId: null,
    }
  }

  await withAudit({ orgId, actorUserId: null }, async (_tx, ctx) => {
    await ctx.emit({
      entity: "billing_checkout",
      action: "session_created",
      entityId: session.id,
      payload: {
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: customerId,
        subscriptionId:
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription?.id ?? null),
        clientReferenceId: session.client_reference_id,
        tier: tierFromMetadata(session.metadata),
      },
    })
  })

  return { kind: "handled", resolvedOrgId: orgId }
}

async function handleInvoicePaid(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  return handleInvoiceLifecycle(event, "paid")
}

async function handleInvoicePaymentFailed(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  return handleInvoiceLifecycle(event, "payment_failed")
}

async function handleInvoiceRequiresAction(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  return handleInvoiceLifecycle(event, "requires_action")
}

async function handleInvoiceLifecycle(
  event: Stripe.Event,
  action: "paid" | "payment_failed" | "requires_action"
): Promise<DispatchOutcome> {
  const invoice = event.data.object as Stripe.Invoice
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : (invoice.customer?.id ?? null)
  if (!customerId) {
    return {
      kind: "ignored",
      reason: "invoice has no customer",
      resolvedOrgId: null,
    }
  }
  const orgId = await resolveOrgIdFromCustomer(customerId)
  if (!orgId) {
    return {
      kind: "ignored",
      reason: `no org resolution for customer ${customerId}`,
      resolvedOrgId: null,
    }
  }

  await withAudit({ orgId, actorUserId: null }, async (_tx, ctx) => {
    await ctx.emit({
      entity: "billing_invoice",
      action,
      entityId: invoice.id ?? null,
      payload: {
        stripeInvoiceId: invoice.id,
        stripeCustomerId: customerId,
        subscriptionId: subscriptionIdFromInvoice(invoice),
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
      },
    })
  })

  return { kind: "handled", resolvedOrgId: orgId }
}

// =============================================================================
// Identity verification handlers
// =============================================================================

async function handleIdentityEvent(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const session = event.data.object as Stripe.Identity.VerificationSession
  // createIdentityVerificationSession writes eleva_expert_profile_id +
  // eleva_org_id to metadata. We accept a few legacy/external fallbacks
  // for robustness, but the fast path uses the eleva_* keys directly.
  const expertProfileId =
    session.metadata?.eleva_expert_profile_id ??
    session.metadata?.expert_profile_id ??
    null
  const metadataOrgId = orgIdFromMetadata(session.metadata)
  const userId = session.metadata?.eleva_user_id ?? null

  let orgId: string | null = metadataOrgId
  let expertId: string | null = expertProfileId

  // If we have an expertProfileId but not orgId, look it up.
  if (expertId && !orgId) {
    orgId = await withPlatformAdminContext(async (tx) => {
      const rows = await tx
        .select({ orgId: main.expertProfiles.orgId })
        .from(main.expertProfiles)
        .where(eq(main.expertProfiles.id, expertId as string))
        .limit(1)
      return rows[0]?.orgId ?? null
    })
  }

  // Last-resort fallback: resolve via user id.
  if ((!orgId || !expertId) && userId) {
    const resolved = await withPlatformAdminContext(async (tx) => {
      const rows = await tx
        .select({
          orgId: main.expertProfiles.orgId,
          id: main.expertProfiles.id,
        })
        .from(main.expertProfiles)
        .where(eq(main.expertProfiles.userId, userId))
        .limit(1)
      return rows[0] ?? null
    })
    orgId = orgId ?? resolved?.orgId ?? null
    expertId = expertId ?? resolved?.id ?? null
  }

  if (!orgId || !expertId) {
    return {
      kind: "ignored",
      reason: "no expert profile resolution for identity event",
      resolvedOrgId: null,
    }
  }

  const action: "verified" | "requires_input" | "canceled" =
    event.type === "identity.verification_session.verified"
      ? "verified"
      : event.type === "identity.verification_session.requires_input"
        ? "requires_input"
        : "canceled"

  const status: (typeof main.stripeIdentityStatusEnum.enumValues)[number] =
    action === "verified"
      ? "verified"
      : action === "requires_input"
        ? "requires_input"
        : "canceled"

  await withAudit({ orgId, actorUserId: null }, async (tx, ctx) => {
    await tx
      .update(main.expertProfiles)
      .set({
        stripeIdentityStatus: status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(main.expertProfiles.id, expertId),
          eq(main.expertProfiles.orgId, orgId)
        )
      )

    await ctx.emit({
      entity: "identity_verification",
      action,
      entityId: session.id,
      payload: {
        stripeVerificationSessionId: session.id,
        expertProfileId: expertId,
        status,
      },
    })
  })

  return { kind: "handled", resolvedOrgId: orgId }
}

// =============================================================================
// Connect platform handlers (account, capability, deauthorization)
// =============================================================================

async function handleAccountUpdated(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const account = event.data.object as Stripe.Account
  const resolved = await resolveOrgIdFromConnectAccount(account.id)
  if (!resolved) {
    return {
      kind: "ignored",
      reason: `no expert profile linked to ${account.id}`,
      resolvedOrgId: null,
    }
  }

  await withAudit(
    { orgId: resolved.orgId, actorUserId: null },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "connect_account",
        action: "updated",
        entityId: account.id,
        payload: {
          stripeAccountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
          requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
          requirementsDisabledReason: account.requirements?.disabled_reason,
        },
      })
    }
  )
  return { kind: "handled", resolvedOrgId: resolved.orgId }
}

async function handleCapabilityUpdated(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const capability = event.data.object as Stripe.Capability
  const stripeAccountId =
    typeof capability.account === "string"
      ? capability.account
      : capability.account?.id
  if (!stripeAccountId) {
    return {
      kind: "ignored",
      reason: "capability has no account",
      resolvedOrgId: null,
    }
  }
  const resolved = await resolveOrgIdFromConnectAccount(stripeAccountId)
  if (!resolved) {
    return {
      kind: "ignored",
      reason: `no expert profile linked to ${stripeAccountId}`,
      resolvedOrgId: null,
    }
  }
  await withAudit(
    { orgId: resolved.orgId, actorUserId: null },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "connect_account",
        action: "capability_changed",
        entityId: stripeAccountId,
        payload: {
          stripeAccountId,
          capabilityId: capability.id,
          status: capability.status,
          requirementsCurrentlyDue:
            capability.requirements?.currently_due ?? [],
        },
      })
    }
  )
  return { kind: "handled", resolvedOrgId: resolved.orgId }
}

async function handleAccountDeauthorized(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const application = event.data.object as Stripe.Application & {
    account?: string
  }
  const stripeAccountId =
    typeof event.account === "string" ? event.account : application.account
  if (!stripeAccountId) {
    return {
      kind: "ignored",
      reason: "deauthorized event with no account id",
      resolvedOrgId: null,
    }
  }
  const resolved = await resolveOrgIdFromConnectAccount(stripeAccountId)
  if (!resolved) {
    return {
      kind: "ignored",
      reason: `no expert profile linked to ${stripeAccountId}`,
      resolvedOrgId: null,
    }
  }
  await withAudit(
    { orgId: resolved.orgId, actorUserId: null },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "connect_account",
        action: "deauthorized",
        entityId: stripeAccountId,
        payload: { stripeAccountId },
      })
    }
  )
  return { kind: "handled", resolvedOrgId: resolved.orgId }
}

// =============================================================================
// Connect payouts
// =============================================================================

async function handlePayoutEvent(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const payout = event.data.object as Stripe.Payout
  const stripeAccountId =
    typeof event.account === "string" ? event.account : null
  if (!stripeAccountId) {
    return {
      kind: "ignored",
      reason: "payout event with no connected account id",
      resolvedOrgId: null,
    }
  }
  const resolved = await resolveOrgIdFromConnectAccount(stripeAccountId)
  if (!resolved) {
    return {
      kind: "ignored",
      reason: `no expert profile linked to ${stripeAccountId}`,
      resolvedOrgId: null,
    }
  }
  const action: "succeeded" | "failed" =
    event.type === "payout.paid" ? "succeeded" : "failed"
  await withAudit(
    { orgId: resolved.orgId, actorUserId: null },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "connect_payout",
        action,
        entityId: payout.id,
        payload: {
          stripePayoutId: payout.id,
          stripeAccountId,
          amount: payout.amount,
          currency: payout.currency,
          arrivalDate: payout.arrival_date,
          method: payout.method,
          status: payout.status,
          failureCode: payout.failure_code,
        },
      })
    }
  )
  return { kind: "handled", resolvedOrgId: resolved.orgId }
}

// =============================================================================
// Booking PaymentIntents (patient checkout) + refunds + disputes
// =============================================================================

async function handlePaymentIntentEvent(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const intent = event.data.object as Stripe.PaymentIntent
  const orgId =
    orgIdFromMetadata(intent.metadata) ??
    (intent.customer
      ? await resolveOrgIdFromCustomer(
          typeof intent.customer === "string"
            ? intent.customer
            : intent.customer.id
        )
      : null)
  if (!orgId) {
    return {
      kind: "ignored",
      reason: "no org resolution for payment intent",
      resolvedOrgId: null,
    }
  }
  const action: "succeeded" | "failed" =
    event.type === "payment_intent.succeeded" ? "succeeded" : "failed"
  await withAudit({ orgId, actorUserId: null }, async (_tx, ctx) => {
    await ctx.emit({
      entity: "booking_payment",
      action,
      entityId: intent.id,
      payload: {
        stripePaymentIntentId: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        lastPaymentError: intent.last_payment_error?.message ?? null,
        bookingId: intent.metadata?.eleva_booking_id ?? null,
      },
    })
  })
  return { kind: "handled", resolvedOrgId: orgId }
}

async function handleChargeRefunded(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const charge = event.data.object as Stripe.Charge
  const orgId = orgIdFromMetadata(charge.metadata)
  if (!orgId) {
    return {
      kind: "ignored",
      reason: "no org resolution for charge.refunded",
      resolvedOrgId: null,
    }
  }
  await withAudit({ orgId, actorUserId: null }, async (_tx, ctx) => {
    await ctx.emit({
      entity: "booking_payment",
      action: "refunded",
      entityId: charge.id,
      payload: {
        stripeChargeId: charge.id,
        stripePaymentIntentId:
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : (charge.payment_intent?.id ?? null),
        amountRefunded: charge.amount_refunded,
        currency: charge.currency,
        bookingId: charge.metadata?.eleva_booking_id ?? null,
      },
    })
  })
  return { kind: "handled", resolvedOrgId: orgId }
}

async function handleChargeDisputeCreated(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const dispute = event.data.object as Stripe.Dispute
  const charge =
    typeof dispute.charge === "string"
      ? null
      : (dispute.charge as Stripe.Charge | undefined)
  const orgId = charge ? orgIdFromMetadata(charge.metadata) : null
  if (!orgId) {
    return {
      kind: "ignored",
      reason: "no org resolution for charge.dispute.created",
      resolvedOrgId: null,
    }
  }
  await withAudit({ orgId, actorUserId: null }, async (_tx, ctx) => {
    await ctx.emit({
      entity: "booking_payment",
      action: "disputed",
      entityId: dispute.id,
      payload: {
        stripeDisputeId: dispute.id,
        stripeChargeId:
          typeof dispute.charge === "string"
            ? dispute.charge
            : dispute.charge.id,
        amount: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
      },
    })
  })
  return { kind: "handled", resolvedOrgId: orgId }
}
