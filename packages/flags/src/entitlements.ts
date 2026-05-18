/**
 * Minimal session shape needed by entitlement checks.
 * Avoids importing @eleva/auth directly (which pulls in JSX).
 */
interface SessionWithEntitlements {
  entitlements?: readonly string[]
}

/**
 * Stripe Entitlement keys mapped to subscription tiers.
 * These keys are set in Stripe Dashboard > Entitlements and
 * flow into the WorkOS access token via the Stripe add-on.
 */
export const ENTITLEMENT_KEYS = {
  MEMBER_FREE: "member_free",
  EXPERT_COMMUNITY: "expert_community",
  EXPERT_TOP: "expert_top",
  CLINIC_STARTER: "clinic_starter",
  CLINIC_GROWTH: "clinic_growth",
} as const

export type EntitlementKey =
  (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS]

/**
 * Check if a session holds a specific entitlement.
 * Returns false gracefully when entitlements are not yet populated
 * (e.g. before the Stripe add-on is enabled in WorkOS).
 */
export function hasEntitlement(
  session: SessionWithEntitlements,
  key: EntitlementKey
): boolean {
  return session.entitlements?.includes(key) ?? false
}

/**
 * Check if the session has any of the given entitlements.
 */
export function hasAnyEntitlement(
  session: SessionWithEntitlements,
  keys: EntitlementKey[]
): boolean {
  if (!session.entitlements || session.entitlements.length === 0) return false
  return keys.some((k) => session.entitlements!.includes(k))
}

/**
 * Commission rate for the current session based on entitlements.
 * - Top Expert: 8%
 * - Expert Community (default): 15%
 * - Clinic Starter/Growth: 0% (subscription covers platform fees)
 */
export function getCommissionRate(session: SessionWithEntitlements): number {
  if (hasEntitlement(session, ENTITLEMENT_KEYS.CLINIC_STARTER)) return 0
  if (hasEntitlement(session, ENTITLEMENT_KEYS.CLINIC_GROWTH)) return 0
  if (hasEntitlement(session, ENTITLEMENT_KEYS.EXPERT_TOP)) return 0.08
  return 0.15
}

/**
 * Whether the session qualifies for priority search ranking.
 */
export function hasPriorityRanking(session: SessionWithEntitlements): boolean {
  return (
    hasEntitlement(session, ENTITLEMENT_KEYS.EXPERT_TOP) ||
    hasEntitlement(session, ENTITLEMENT_KEYS.CLINIC_GROWTH)
  )
}

/**
 * Whether the session has access to the advanced CRM features.
 */
export function hasAdvancedCRM(session: SessionWithEntitlements): boolean {
  return (
    hasEntitlement(session, ENTITLEMENT_KEYS.EXPERT_TOP) ||
    hasEntitlement(session, ENTITLEMENT_KEYS.CLINIC_STARTER) ||
    hasEntitlement(session, ENTITLEMENT_KEYS.CLINIC_GROWTH)
  )
}
