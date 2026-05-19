import { and, eq, sql } from "drizzle-orm"
import type Stripe from "stripe"
import { z } from "zod"
import { withAudit } from "@eleva/audit"
import { main, withPlatformAdminContext, type Tx } from "@eleva/db"
import { captureException } from "@eleva/observability"
import { stripe } from "./client"

/**
 * Stripe webhook processor (Phase 1 of stripe-foundation-review).
 *
 * Single entrypoint: `processStripeEvent(event)`.
 *
 * Responsibilities:
 *
 *   1. Idempotency state machine. Each event flows through
 *        received -> processing -> processed | failed | ignored
 *      via a CLAIM-style upsert. On retry, only rows in `received`,
 *      `failed`, or stale `processing` (older than STALE_PROCESSING_MS)
 *      are re-claimed. Rows in `processed` or `ignored` short-circuit
 *      to {status: "duplicate"} and the route returns 200.
 *
 *   2. Dispatch by event.type. Each branch resolves the tenant `orgId`
 *      from event metadata / customer / connected account, then writes
 *      its mirror under `withAudit({ orgId, actorUserId: null })`.
 *      `actorUserId: null` indicates a system actor; the multi-admin
 *      attribution pattern in ADR-016 correlates the audited Portal
 *      session-mint with these events for actor inference.
 *
 *   3. Result reporting. Update `stripe_webhook_events.status` to
 *      `processed` (with `processed_at`), `failed` (with truncated
 *      error), or `ignored` (with `ignore_reason`). Operators can
 *      query each terminal state separately.
 *
 * The processor MUST NOT throw to its caller for "valid but unhandled"
 * events -- Stripe should NOT retry those. It throws only for truly
 * retryable errors (DB outage, transient WorkOS failure) so the route
 * can return non-2xx and let Stripe redeliver.
 */

const ERROR_TRUNCATE_LENGTH = 2000

/**
 * Maximum age for a `processing` row before a retry is allowed to
 * reclaim it. Defends against a worker dying mid-handle.
 */
const STALE_PROCESSING_MS = 10 * 60 * 1000 // 10 minutes

/**
 * F2 enhancement: marker class for unrecoverable handler errors. When a
 * handler throws a `TerminalError`, the processor records the event as
 * `failed_terminal` so the claim flow does NOT re-run it on Stripe
 * retries (which would just keep failing with the same error).
 *
 * Use for:
 *   - malformed payloads (missing required fields the API contract
 *     guarantees)
 *   - validation errors that won't change between retries (e.g. invalid
 *     tier name in metadata)
 *   - logic bugs surfaced by the event (no retry will fix them)
 *
 * Do NOT use for transient errors (DB outage, network blip, Stripe 5xx);
 * those should throw normal Error and become `failed` (retryable).
 */
export class TerminalError extends Error {
  override readonly name = "TerminalError"
  constructor(message: string) {
    super(message)
  }
}

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
type DispatchOutcome = IgnoredOutcome | HandledOutcome

export async function processStripeEvent(
  event: Stripe.Event
): Promise<StripeEventResult> {
  const claim = await tryClaimEvent(event)
  if (!claim.claimed) {
    return { status: "duplicate", eventId: event.id }
  }

  try {
    const dispatch = await dispatchEvent(event)
    if (dispatch.kind === "ignored") {
      await markIgnored(event.id, dispatch.reason, dispatch.resolvedOrgId)
      return {
        status: "ignored",
        eventId: event.id,
        eventType: event.type,
        reason: dispatch.reason,
      }
    }
    await markProcessed(event.id, dispatch.resolvedOrgId)
    return {
      status: "processed",
      eventId: event.id,
      eventType: event.type,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown handler error"
    const terminal = err instanceof TerminalError
    if (terminal) {
      await markFailedTerminal(event.id, message)
    } else {
      await markFailed(event.id, message)
    }
    // Fire-and-forget Sentry capture; never block on observability.
    void captureException(err, {
      stripeEventId: event.id,
      stripeEventType: event.type,
      livemode: event.livemode,
      terminal,
    }).catch(() => {})
    return {
      status: "failed",
      eventId: event.id,
      eventType: event.type,
      error: message,
    }
  }
}

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
    // alongside the new `paid` event).
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
        reason: `no handler registered for event type ${event.type}`,
        resolvedOrgId: null,
      }
  }
}

// =============================================================================
// Idempotency state machine: claim/processed/failed/ignored
// =============================================================================

interface ClaimResult {
  claimed: boolean
}

/**
 * Three-state idempotency claim. Allowed transitions:
 *   (no row)                        -> processing  (insert)
 *   received                        -> processing  (update)
 *   failed                          -> processing  (update; retry)
 *   processing (older than 10 min)  -> processing  (update; recover)
 *   processed | ignored             -> NO-OP (returns claimed=false)
 *
 * Rows in stale `processing` indicate a worker died mid-handle. Stripe
 * retries will reclaim them; ops can query for them via attempts > 1.
 */
async function tryClaimEvent(event: Stripe.Event): Promise<ClaimResult> {
  const now = new Date()
  const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MS)

  const result = await withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .insert(main.stripeWebhookEvents)
      .values({
        eventId: event.id,
        eventType: event.type,
        livemode: event.livemode,
        apiVersion: event.api_version,
        eventCreatedAt: new Date(event.created * 1000),
        status: "processing",
        attempts: 1,
        lastAttemptAt: now,
      })
      .onConflictDoUpdate({
        target: main.stripeWebhookEvents.eventId,
        set: {
          status: "processing",
          attempts: sql`${main.stripeWebhookEvents.attempts} + 1`,
          lastAttemptAt: now,
        },
        where: sql`(
          ${main.stripeWebhookEvents.status} IN ('received', 'failed') OR
          (${main.stripeWebhookEvents.status} = 'processing' AND
           ${main.stripeWebhookEvents.lastAttemptAt} < ${staleCutoff})
        )`,
      })
      .returning({ eventId: main.stripeWebhookEvents.eventId })
    return rows
  })
  return { claimed: result.length > 0 }
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
        // Clear any prior error/ignore_reason on success.
        error: null,
        ignoreReason: null,
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

/**
 * F2 enhancement: terminal failure marker. The claim flow excludes
 * `failed_terminal` rows so subsequent Stripe retries short-circuit to
 * 'duplicate' and Stripe stops retrying. Use only for unrecoverable
 * errors raised via TerminalError.
 */
async function markFailedTerminal(
  eventId: string,
  error: string
): Promise<void> {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.stripeWebhookEvents)
      .set({
        status: "failed_terminal",
        processedAt: new Date(),
        error: error.slice(0, ERROR_TRUNCATE_LENGTH),
      })
      .where(eq(main.stripeWebhookEvents.eventId, eventId))
  })
}

async function markIgnored(
  eventId: string,
  reason: string,
  resolvedOrgId?: string | null
): Promise<void> {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.stripeWebhookEvents)
      .set({
        status: "ignored",
        processedAt: new Date(),
        ignoreReason: reason.slice(0, ERROR_TRUNCATE_LENGTH),
        resolvedOrgId: resolvedOrgId ?? null,
      })
      .where(eq(main.stripeWebhookEvents.eventId, eventId))
  })
}

// =============================================================================
// Tenant resolution helpers
// =============================================================================

/**
 * Resolve org_id for a Stripe Customer ID via the billing_customers
 * mirror under platform-admin context.
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
 * Resolve org_id by expert_profile_id (used when Connect events arrive
 * before stripe_account_id has been written to the local mirror, but
 * the Stripe Account metadata still carries `eleva_expert_profile_id`).
 */
async function resolveOrgIdFromExpertProfileId(
  expertProfileId: string
): Promise<{ orgId: string; expertProfileId: string } | null> {
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        orgId: main.expertProfiles.orgId,
        expertProfileId: main.expertProfiles.id,
      })
      .from(main.expertProfiles)
      .where(eq(main.expertProfiles.id, expertProfileId))
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
/**
 * @internal Read `eleva_org_id` from Stripe metadata. Exposed for tests.
 */
export function orgIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): string | null {
  if (!metadata) return null
  const value = metadata["eleva_org_id"]
  if (typeof value !== "string" || value.length < 36) return null
  return value
}

/**
 * @internal Read `eleva_tier` from Stripe metadata. Exposed for tests.
 */
export function tierFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): string {
  if (!metadata) return "unknown"
  const tier = metadata["eleva_tier"]
  return typeof tier === "string" && tier.length > 0 ? tier : "unknown"
}

/**
 * Extract the subscription id from an Invoice. In Stripe API >= 2025
 * `invoice.subscription` was removed in favor of
 * `invoice.parent.subscription_details.subscription`. We probe the new
 * path first, then the legacy path for back-compat with events delivered
 * under older API versions.
 */
/**
 * @internal Extract the subscription id from an Invoice across API
 * versions. Exposed for tests; see invariants in the JSDoc above.
 */
export function subscriptionIdFromInvoice(
  invoice: Stripe.Invoice
): string | null {
  const sub = invoice.parent?.subscription_details?.subscription ?? null
  if (sub) return typeof sub === "string" ? sub : sub.id
  const legacy = (invoice as unknown as { subscription?: unknown }).subscription
  if (typeof legacy === "string") return legacy
  if (legacy && typeof legacy === "object" && "id" in legacy) {
    return (legacy as { id: string }).id
  }
  return null
}

/**
 * Read the subscription's billing period start/end. In Stripe API >=
 * 2025-03-31.basil these moved from the top-level Subscription onto
 * each SubscriptionItem. Eleva subscriptions have aligned items, so
 * reading from items[0] is correct for current API versions; legacy
 * top-level fields are probed as a defensive fallback.
 */
/**
 * @internal Read subscription billing period across API versions.
 * Exposed for unit tests.
 */
export function subscriptionPeriod(subscription: Stripe.Subscription): {
  start: Date | null
  end: Date | null
} {
  const firstItem = subscription.items.data[0]
  const legacy = subscription as unknown as {
    current_period_start?: number
    current_period_end?: number
  }
  const startSec =
    firstItem?.current_period_start ?? legacy.current_period_start
  const endSec = firstItem?.current_period_end ?? legacy.current_period_end
  return {
    start: startSec ? new Date(startSec * 1000) : null,
    end: endSec ? new Date(endSec * 1000) : null,
  }
}

/**
 * Look up the prior status + last applied event timestamp from a
 * subscription mirror row. Used to detect reactivation /
 * past_due_recovery transitions AND to enforce event ordering (F3).
 */
async function previousMirror(stripeSubscriptionId: string): Promise<{
  status: string
  lastEventCreatedAt: Date | null
} | null> {
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        status: main.billingSubscriptions.status,
        lastEventCreatedAt: main.billingSubscriptions.lastEventCreatedAt,
      })
      .from(main.billingSubscriptions)
      .where(
        eq(main.billingSubscriptions.stripeSubscriptionId, stripeSubscriptionId)
      )
      .limit(1)
    return rows[0] ?? null
  })
}

// =============================================================================
// Subscription lifecycle handlers
// =============================================================================

const subscriptionStatusSchema = z.enum(
  main.stripeSubscriptionStatusEnum.enumValues
)

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
    return {
      kind: "ignored",
      reason: `no org resolution for customer ${customerId}`,
      resolvedOrgId: null,
    }
  }

  const tier = tierFromMetadata(subscription.metadata)

  const statusParse = subscriptionStatusSchema.safeParse(subscription.status)
  if (!statusParse.success) {
    return {
      kind: "ignored",
      reason: `unknown subscription status: ${subscription.status}`,
      resolvedOrgId: orgId,
    }
  }
  const status = statusParse.data

  // F3: event ordering protection. Stripe does NOT guarantee webhook
  // delivery order. If we receive an older event after a newer one has
  // already been applied, the OLD event must NOT overwrite mirror
  // state (e.g. an out-of-order subscription.deleted reverting an
  // active subscription back to canceled).
  const eventCreatedAt = new Date(event.created * 1000)
  const priorMirror = await previousMirror(subscription.id)
  if (
    priorMirror?.lastEventCreatedAt &&
    eventCreatedAt < priorMirror.lastEventCreatedAt
  ) {
    return {
      kind: "ignored",
      reason: `stale event (created ${eventCreatedAt.toISOString()} < last ${priorMirror.lastEventCreatedAt.toISOString()})`,
      resolvedOrgId: orgId,
    }
  }

  const priorStatus = priorMirror?.status ?? null
  const action = mapSubscriptionAction(event.type, status, priorStatus)

  await withAudit({ orgId, actorUserId: null }, async (tx, ctx) => {
    await upsertSubscriptionMirror(tx, {
      orgId,
      subscription,
      tier,
      status,
      customerId,
      eventCreatedAt,
    })

    // F3: top_expert_active is mirrored from EVERY subscription event,
    // regardless of tier, so downgrades / cancellations / past_due
    // transitions correctly clear the flag. The query no-ops when no
    // expert profile exists for the org (clinic orgs are unaffected).
    const desiredTopExpertActive =
      tier === "expert_top" && (status === "active" || status === "trialing")
    await tx
      .update(main.expertProfiles)
      .set({
        topExpertActive: desiredTopExpertActive,
        updatedAt: new Date(),
      })
      .where(eq(main.expertProfiles.orgId, orgId))

    const period = subscriptionPeriod(subscription)
    await ctx.emit({
      entity: "billing_subscription",
      action,
      entityId: subscription.id,
      payload: {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        tier,
        status,
        priorStatus,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: period.end?.toISOString() ?? null,
      },
    })
  })

  return { kind: "handled", resolvedOrgId: orgId }
}

/**
 * @internal Pure mapping function exposed for unit tests. Maps a
 * subscription event + status transition to the audit action that
 * captures the semantic transition (created / updated / canceled /
 * reactivated / past_due_recovered).
 */
export function mapSubscriptionAction(
  eventType: string,
  status: (typeof main.stripeSubscriptionStatusEnum.enumValues)[number],
  priorStatus: string | null
): "created" | "updated" | "canceled" | "reactivated" | "past_due_recovered" {
  if (eventType === "customer.subscription.created") return "created"
  if (eventType === "customer.subscription.deleted") return "canceled"
  // F10: distinguish reactivation and past_due recovery from generic update.
  if (status === "active" && priorStatus === "past_due") {
    return "past_due_recovered"
  }
  if (status === "active" && priorStatus === "canceled") {
    return "reactivated"
  }
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
    /** F3: timestamp from event.created; persisted on the row so retries
     * can compare and skip stale events (Stripe does not guarantee
     * webhook delivery order). */
    eventCreatedAt: Date
  }
): Promise<void> {
  const { orgId, subscription, tier, status, customerId, eventCreatedAt } =
    input
  const priceIds = subscription.items.data.map((item) => item.price.id)
  const seatItemId =
    subscription.items.data.find(
      (item) =>
        item.price.metadata?.eleva_price_type === "per_seat" ||
        item.price.metadata?.eleva_price_type === "per_seat_metered" ||
        item.price.recurring?.usage_type === "metered"
    )?.id ?? null

  const period = subscriptionPeriod(subscription)
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
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt,
      metadata: subscription.metadata as Record<string, unknown>,
      lastEventCreatedAt: eventCreatedAt,
    })
    .onConflictDoUpdate({
      target: main.billingSubscriptions.stripeSubscriptionId,
      set: {
        status,
        tier,
        priceIds,
        seatItemId,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt,
        metadata: subscription.metadata as Record<string, unknown>,
        lastEventCreatedAt: eventCreatedAt,
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
  // eleva_org_id to metadata. Fast path uses the eleva_* keys directly.
  const expertProfileId =
    session.metadata?.eleva_expert_profile_id ??
    session.metadata?.expert_profile_id ??
    null
  const metadataOrgId = orgIdFromMetadata(session.metadata)
  const userId = session.metadata?.eleva_user_id ?? null

  let orgId: string | null = metadataOrgId
  let expertId: string | null = expertProfileId

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

/**
 * F7: Resolve org for a Connect event with a multi-strategy fallback:
 *   1. expert_profiles.stripe_account_id mirror lookup.
 *   2. account.metadata.eleva_expert_profile_id (stamped at creation).
 *   3. account.metadata.eleva_org_id.
 */
async function resolveOrgFromConnectAccount(
  account: Stripe.Account | null,
  stripeAccountId: string
): Promise<{ orgId: string; expertProfileId: string | null } | null> {
  const direct = await resolveOrgIdFromConnectAccount(stripeAccountId)
  if (direct) return direct

  if (!account) return null
  const expertProfileId = account.metadata?.eleva_expert_profile_id
  if (typeof expertProfileId === "string" && expertProfileId.length >= 36) {
    const byProfile = await resolveOrgIdFromExpertProfileId(expertProfileId)
    if (byProfile) return byProfile
  }
  const metadataOrgId = orgIdFromMetadata(account.metadata)
  if (metadataOrgId) {
    return { orgId: metadataOrgId, expertProfileId: null }
  }
  return null
}

async function handleAccountUpdated(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const account = event.data.object as Stripe.Account
  const resolved = await resolveOrgFromConnectAccount(account, account.id)
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
  // capability.account may be expanded; we only use the id for resolution.
  const resolved = await resolveOrgFromConnectAccount(null, stripeAccountId)
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
  // For account.application.deauthorized, the deauthorized account id is
  // on event.account (NOT data.object, which is the Application).
  const stripeAccountId =
    typeof event.account === "string"
      ? event.account
      : (event.data.object as Stripe.Application & { account?: string }).account
  if (!stripeAccountId) {
    return {
      kind: "ignored",
      reason: "deauthorized event with no account id",
      resolvedOrgId: null,
    }
  }
  const resolved = await resolveOrgFromConnectAccount(null, stripeAccountId)
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
  const resolved = await resolveOrgFromConnectAccount(null, stripeAccountId)
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

/**
 * F8: charge.refunded resolution chain:
 *   1. charge.metadata.eleva_org_id (fast path).
 *   2. charge.payment_intent metadata via retrieve (fallback when
 *      org id was only stamped on the PaymentIntent at creation time).
 *   3. customer mirror lookup (last resort).
 */
async function handleChargeRefunded(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const charge = event.data.object as Stripe.Charge
  let orgId = orgIdFromMetadata(charge.metadata)
  if (!orgId && charge.payment_intent) {
    orgId = await orgIdFromPaymentIntent(charge.payment_intent)
  }
  if (!orgId && charge.customer) {
    const customerId =
      typeof charge.customer === "string" ? charge.customer : charge.customer.id
    orgId = await resolveOrgIdFromCustomer(customerId)
  }
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

/**
 * F5: charge.dispute.created resolution chain. Stripe sends dispute.charge
 * as a string ID by default (not expanded). We retrieve the charge to
 * read its metadata, and fall back to the PaymentIntent if needed.
 */
async function handleChargeDisputeCreated(
  event: Stripe.Event
): Promise<DispatchOutcome> {
  const dispute = event.data.object as Stripe.Dispute
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id

  let charge: Stripe.Charge | null
  if (typeof dispute.charge === "string") {
    try {
      charge = await stripe().charges.retrieve(chargeId)
    } catch (err) {
      // If the charge can't be retrieved, fall through with null and
      // attempt PaymentIntent resolution from any expanded data we have.
      charge = null
      console.warn(
        `[stripe-webhook] charge retrieve failed for dispute ${dispute.id}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  } else {
    charge = dispute.charge as Stripe.Charge
  }

  let orgId: string | null = charge ? orgIdFromMetadata(charge.metadata) : null
  if (!orgId && charge?.payment_intent) {
    orgId = await orgIdFromPaymentIntent(charge.payment_intent)
  }
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
        stripeChargeId: chargeId,
        amount: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
      },
    })
  })
  return { kind: "handled", resolvedOrgId: orgId }
}

/**
 * Resolve eleva_org_id from a Stripe.Charge.payment_intent reference.
 * Accepts either a string id (retrieves the PaymentIntent) or the
 * already-expanded PaymentIntent object.
 */
async function orgIdFromPaymentIntent(
  ref: string | Stripe.PaymentIntent
): Promise<string | null> {
  if (typeof ref !== "string") {
    return orgIdFromMetadata(ref.metadata)
  }
  try {
    const pi = await stripe().paymentIntents.retrieve(ref)
    return orgIdFromMetadata(pi.metadata)
  } catch (err) {
    console.warn(
      `[stripe-webhook] paymentIntent retrieve failed for ${ref}: ${err instanceof Error ? err.message : String(err)}`
    )
    return null
  }
}
