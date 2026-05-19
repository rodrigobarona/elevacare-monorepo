import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn, updatedAt } from "./shared"
import { organizations } from "./organizations"

/**
 * Stripe billing persistence layer (Phase 1 of stripe-foundation-review).
 *
 * Three tables:
 *
 *   stripe_webhook_events  - Platform-level webhook idempotency log.
 *                            PK is the Stripe event.id; insert-on-conflict
 *                            short-circuits duplicate deliveries. NOT
 *                            tenant-scoped (platform infrastructure).
 *
 *   billing_customers      - Org -> Stripe Customer mirror. Tenant-scoped.
 *                            Stripe metadata is the source of truth; this
 *                            mirror exists for fast lookups + admin/support
 *                            queries. WorkOS `stripeCustomerId` on the org
 *                            remains the canonical link for entitlements.
 *
 *   billing_subscriptions  - Stripe Subscription mirror. Tenant-scoped.
 *                            Authoritative for app-side reads of
 *                            "is this subscription active / past_due /
 *                            canceled" without hitting Stripe per request.
 *
 * Feature gating still reads from the WorkOS access-token `entitlements`
 * claim (see ADR-016). These mirrors are for support, audit, and admin
 * tooling, not entitlement decisions.
 */

export const stripeWebhookEventStatusEnum = pgEnum(
  "stripe_webhook_event_status",
  [
    "received",
    "processing",
    "processed",
    // `failed` = retryable (DB outage, transient Stripe error); the
    // claim flow allows it to be re-claimed on the next delivery.
    "failed",
    // `failed_terminal` = unrecoverable (malformed payload, validation
    // error, missing required metadata that's not coming back). The
    // claim flow does NOT re-claim it; Stripe stops retrying because
    // the route returns 200.
    "failed_terminal",
    "ignored",
  ]
)

/**
 * Stripe Subscription status, mirrored from the Stripe API. These values
 * map 1:1 to https://docs.stripe.com/api/subscriptions/object#subscription_object-status
 */
export const stripeSubscriptionStatusEnum = pgEnum(
  "stripe_subscription_status",
  [
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
  ]
)

/**
 * Idempotency log for Stripe webhook deliveries. Inserted with
 * status='received' on first delivery via INSERT ... ON CONFLICT DO
 * NOTHING. The webhook handler updates status='processed' (with
 * processed_at) once the event has been dispatched successfully, or
 * status='failed' (with error) when a retryable handler error occurs.
 *
 * NOT tenant-scoped: Stripe events are platform-level until the handler
 * resolves the org from event metadata. The handler then writes its
 * tenant-scoped mirror updates inside `withAudit({ orgId, ... })`.
 */
export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    /** Stripe event.id (e.g. "evt_1NxYz...") - primary idempotency key. */
    eventId: varchar("event_id", { length: 255 }).primaryKey(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    livemode: boolean("livemode").notNull(),
    apiVersion: varchar("api_version", { length: 32 }),
    /** Stripe event.created (seconds since epoch, converted to timestamp). */
    eventCreatedAt: timestamp("event_created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`now()`),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "date",
    }),
    status: stripeWebhookEventStatusEnum("status")
      .notNull()
      .default("received"),
    /** Last error message if status='failed'. Truncated to 2k chars. */
    error: text("error"),
    /**
     * Reason recorded when status='ignored' (e.g. "no org resolution for
     * customer cus_..."). Lets operators query silent no-ops separately
     * from successful processing.
     */
    ignoreReason: text("ignore_reason"),
    /**
     * Number of dispatch attempts. Incremented on each (re-)claim of the
     * row from received/failed -> processing. Useful for diagnostics and
     * for stuck-event alerting.
     */
    attempts: integer("attempts").notNull().default(0),
    /** Timestamp of the most recent claim attempt. */
    lastAttemptAt: timestamp("last_attempt_at", {
      withTimezone: true,
      mode: "date",
    }),
    /**
     * Optional resolved org id. Set when the handler successfully maps the
     * event to a tenant (via metadata, customer, or connected account).
     * Useful for support queries; not used for RLS (the table itself is
     * platform-level, not tenant-scoped).
     */
    resolvedOrgId: uuid("resolved_org_id"),
  },
  (t) => ({
    typeIdx: index("stripe_webhook_events_type_idx").on(t.eventType),
    receivedIdx: index("stripe_webhook_events_received_idx").on(t.receivedAt),
    statusIdx: index("stripe_webhook_events_status_idx").on(t.status),
  })
)

/**
 * Org -> Stripe Customer mirror. Created when an org is provisioned (see
 * `provisionOrgBilling` in @eleva/billing/server). The
 * organizations.stripeCustomerId on the WorkOS side remains the canonical
 * link for AuthKit entitlement claims; this mirror exists so the API and
 * support tooling can answer "what is the Stripe customer for this org?"
 * without round-tripping WorkOS or searching Stripe metadata.
 */
export const billingCustomers = pgTable(
  "billing_customers",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    workosOrgId: varchar("workos_org_id", { length: 255 }).notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
    /** Snapshot of Stripe customer metadata at last sync. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: uniqueIndex("billing_customers_org_idx").on(t.orgId),
    stripeIdx: uniqueIndex("billing_customers_stripe_idx").on(
      t.stripeCustomerId
    ),
    workosIdx: index("billing_customers_workos_idx").on(t.workosOrgId),
    tenantPolicy: pgPolicy("billing_customers_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

/**
 * Stripe Subscription mirror. Updated from webhook events in
 * `customer.subscription.{created,updated,deleted}` and
 * `invoice.{paid,payment_failed,payment_action_required}`.
 *
 * Per ADR-016, subscriptions for SaaS tiers (Top Expert, clinic Starter /
 * Growth / Enterprise) use Embedded Checkout for purchase and Customer
 * Portal for management. The `tier` column mirrors the
 * `subscription.metadata.eleva_tier` set at Checkout Session creation.
 */
export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    stripeSubscriptionId: varchar("stripe_subscription_id", {
      length: 255,
    }).notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
    /**
     * Eleva product tier matching @eleva/billing/server PRODUCT_KEYS
     * (e.g. "expert_top", "clinic_starter"). Sourced from
     * subscription.metadata.eleva_tier; "unknown" when metadata is missing.
     */
    tier: varchar("tier", { length: 64 }).notNull().default("unknown"),
    status: stripeSubscriptionStatusEnum("status").notNull(),
    /** Stripe price IDs of the items currently on the subscription. */
    priceIds: text("price_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Subscription item ID for the metered seat (WorkOS Seat Sync), if any. */
    seatItemId: varchar("seat_item_id", { length: 255 }),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
      mode: "date",
    }),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
      mode: "date",
    }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true, mode: "date" }),
    /** Snapshot of Stripe subscription metadata at last sync. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /**
     * F3: timestamp from `event.created` of the most recent event
     * applied to this row. Stripe does NOT guarantee webhook delivery
     * ordering, so handlers compare the incoming event's `created` to
     * this column and skip stale events. Without this, an
     * out-of-order `customer.subscription.deleted` could overwrite a
     * subsequent `customer.subscription.updated` (status='active'),
     * causing a cancelled subscription to look active again.
     */
    lastEventCreatedAt: timestamp("last_event_created_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("billing_subscriptions_org_idx").on(t.orgId),
    stripeIdx: uniqueIndex("billing_subscriptions_stripe_idx").on(
      t.stripeSubscriptionId
    ),
    customerIdx: index("billing_subscriptions_customer_idx").on(
      t.stripeCustomerId
    ),
    statusIdx: index("billing_subscriptions_status_idx").on(t.status),
    tenantPolicy: pgPolicy("billing_subscriptions_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect
export type NewStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert
export type StripeWebhookEventStatus =
  (typeof stripeWebhookEventStatusEnum.enumValues)[number]

export type BillingCustomer = typeof billingCustomers.$inferSelect
export type NewBillingCustomer = typeof billingCustomers.$inferInsert

export type BillingSubscription = typeof billingSubscriptions.$inferSelect
export type NewBillingSubscription = typeof billingSubscriptions.$inferInsert
export type StripeSubscriptionStatus =
  (typeof stripeSubscriptionStatusEnum.enumValues)[number]
