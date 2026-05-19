import {
  ENTITLEMENT_KEYS,
  getCommissionRate as flagsGetCommissionRate,
  hasAdvancedCRM,
  hasAnyEntitlement,
  hasEntitlement,
  hasPriorityRanking,
} from "@eleva/flags"

/**
 * Commission + entitlement helpers for the billing domain.
 *
 * Phase 1 of W1 wires `@eleva/flags` into a stable boundary inside
 * `@eleva/billing/server`. Booking, marketplace, and admin code calls
 * these helpers instead of reading `session.entitlements` directly,
 * so the Stripe Entitlements -> WorkOS JWT -> app-behavior chain has
 * one canonical entry point.
 *
 * The helpers are pure functions on the session shape and don't touch
 * Stripe at runtime (entitlements arrive via the WorkOS access-token
 * JWT). They are SSR-safe and edge-runtime safe.
 *
 * Source-of-truth wiring:
 *   - Stripe Entitlement features seeded by infra/stripe/seed-entitlements
 *   - Customer subscription -> WorkOS Add-on -> JWT entitlements claim
 *   - JWT parsed in @eleva/auth resolveWorkosIdentity into ElevaSession
 *   - Booking domain calls computeCommissionRate(session) here
 *
 * See ADR-016 for the full chain.
 */

/**
 * Minimal session shape consumed by the commission helpers. Avoids
 * importing the full ElevaSession type so this module can be used by
 * code paths that don't have @eleva/auth as a peer.
 */
export interface BillingSession {
  entitlements?: readonly string[]
}

/**
 * Computes the platform commission rate that should apply to a
 * booking's gross amount. Solo expert defaults to 15%; Top Expert
 * subscribers get 8%. Clinic tiers pay nothing per booking (their
 * SaaS subscription covers platform costs).
 *
 * Returns a rate in [0, 1] (e.g. 0.08 = 8%).
 */
export function computeCommissionRate(session: BillingSession): number {
  return flagsGetCommissionRate(session)
}

/**
 * Whether the session qualifies for priority search ranking.
 * Top Expert + Clinic Growth get the boost.
 */
export function isPriorityRanked(session: BillingSession): boolean {
  return hasPriorityRanking(session)
}

/**
 * Whether the session has access to the advanced CRM features
 * (member analytics, custom branding, etc.).
 */
export function hasCRMAccess(session: BillingSession): boolean {
  return hasAdvancedCRM(session)
}

/**
 * Whether the session has the Top Expert entitlement (8% commission,
 * priority ranking, advanced CRM).
 */
export function isTopExpert(session: BillingSession): boolean {
  return hasEntitlement(session, ENTITLEMENT_KEYS.EXPERT_TOP)
}

/**
 * Whether the session has any clinic SaaS entitlement (Starter or Growth).
 */
export function isClinicSaaS(session: BillingSession): boolean {
  return hasAnyEntitlement(session, [
    ENTITLEMENT_KEYS.CLINIC_STARTER,
    ENTITLEMENT_KEYS.CLINIC_GROWTH,
  ])
}

export { ENTITLEMENT_KEYS, type EntitlementKey } from "@eleva/flags"
