/**
 * RLS policy-class taxonomy (docs/eleva-v3/schema-and-migration-rules.md).
 *
 * Every tenant-scoped table declares exactly one class, except
 * `audit_events` which splits SELECT (`selectClass`) from INSERT (`class`).
 * The class suite (`src/__tests__/rls-classes.test.ts`) is parametrised
 * from this list.
 */

export const RLS_POLICY_CLASSES = [
  "tenant-owned",
  "dual-organization",
  "owner-user-visible",
  "participant-visible",
  "staff-only",
  "public-read",
  "service-only",
] as const

export type RlsPolicyClass = (typeof RLS_POLICY_CLASSES)[number]

export type RlsTableAssignment = {
  table: string
  /** INSERT / WITH CHECK class. Also the SELECT class unless `selectClass` is set. */
  class: RlsPolicyClass
  /**
   * SELECT / USING class when it differs from writes. Two splits today:
   * `audit_events` (tenant-owned reads, service-only inserts) and
   * `public_handles` (public-read SELECT, staff-only writes). Not an eighth class.
   */
  selectClass?: RlsPolicyClass
}

/** Current table → class map. Keep in sync with schema-and-migration-rules.md. */
export const RLS_TABLE_ASSIGNMENTS: readonly RlsTableAssignment[] = [
  { table: "expert_profiles", class: "tenant-owned" },
  { table: "expert_listings", class: "public-read" },
  { table: "clinic_profiles", class: "public-read" },
  { table: "expert_integrations", class: "tenant-owned" },
  { table: "schedules", class: "tenant-owned" },
  { table: "availability_rules", class: "tenant-owned" },
  { table: "date_overrides", class: "tenant-owned" },
  { table: "event_types", class: "tenant-owned" },
  { table: "event_type_modes", class: "tenant-owned" },
  { table: "booking_links", class: "tenant-owned" },
  { table: "calendar_feed_tokens", class: "tenant-owned" },
  {
    table: "public_handles",
    class: "staff-only",
    selectClass: "public-read",
  },
  { table: "expert_practice_locations", class: "tenant-owned" },
  { table: "event_locations", class: "tenant-owned" },
  { table: "calendar_busy_sources", class: "tenant-owned" },
  { table: "calendar_destinations", class: "tenant-owned" },
  { table: "slot_reservations", class: "tenant-owned" },
  { table: "bookings", class: "dual-organization" },
  { table: "sessions", class: "participant-visible" },
  { table: "billing_customers", class: "tenant-owned" },
  { table: "billing_subscriptions", class: "tenant-owned" },
  { table: "org_data_keys", class: "tenant-owned" },
  { table: "audit_outbox", class: "service-only" },
  { table: "stripe_webhook_events", class: "service-only" },
  { table: "expert_categories", class: "public-read" },
  {
    table: "audit_events",
    class: "service-only",
    selectClass: "tenant-owned",
  },
]

export type RlsClassFixture = {
  class: RlsPolicyClass
  table: string
  synthetic: boolean
}

/**
 * One fixture per class. Classes with a current un-split table use that
 * table. Split-predicate tables (`public_handles`, `audit_events`) cannot
 * prove a single class, so `staff-only` stays on `_rls_fixture_staff_only`.
 * FK-heavy tables (`bookings`, `sessions`, `expert_listings`) still get a
 * real-table existence check; their predicate is proven on a same-shape
 * synthetic table so the suite does not have to seed the full booking graph.
 */
export const RLS_CLASS_FIXTURES: readonly RlsClassFixture[] = [
  { class: "tenant-owned", table: "org_data_keys", synthetic: false },
  { class: "dual-organization", table: "bookings", synthetic: false },
  {
    class: "owner-user-visible",
    table: "_rls_fixture_owner_user_visible",
    synthetic: true,
  },
  { class: "participant-visible", table: "sessions", synthetic: false },
  { class: "staff-only", table: "_rls_fixture_staff_only", synthetic: true },
  { class: "public-read", table: "expert_listings", synthetic: false },
  { class: "service-only", table: "audit_outbox", synthetic: false },
]

/** Canonical USING/WITH CHECK predicates for the class suite. */
export function classPredicateSql(
  rlsClass: RlsPolicyClass,
  table: string
): string {
  switch (rlsClass) {
    case "tenant-owned":
      return `org_id::text = current_setting('eleva.org_id', true)`
    case "dual-organization":
      return (
        `org_id::text = current_setting('eleva.org_id', true)` +
        ` OR counterparty_org_id::text = current_setting('eleva.org_id', true)`
      )
    case "owner-user-visible":
      return `user_id::text = current_setting('eleva.user_id', true)`
    case "participant-visible":
      return `member_user_id::text = current_setting('eleva.user_id', true)`
    case "staff-only":
      return `current_setting('eleva.platform_admin', true) = 'true'`
    case "public-read":
      return `true`
    case "service-only":
      if (
        table === "audit_events" ||
        table === "_rls_fixture_audit_events_split"
      ) {
        return `current_setting('eleva.service', true) = 'audit_drainer'`
      }
      return (
        `current_setting('eleva.platform_admin', true) = 'true'` +
        ` OR current_setting('eleva.service', true) IN ('stripe_webhook', 'audit_drainer')`
      )
    default: {
      const _exhaustive: never = rlsClass
      throw new Error(`unknown RLS class: ${_exhaustive}`)
    }
  }
}
