/**
 * Eleva product labels \u2014 derived from (org.type, membership.workos_role)
 * per identity-rbac-spec.md. NOT stored; computed at session-read time.
 */
export type ProductLabel =
  | "member"
  | "expert"
  | "team_admin"
  | "lecturer"
  | "staff"

export interface ElevaSession {
  user: {
    id: string
    workosUserId: string
    email: string
    displayName?: string | null
    avatarUrl?: string | null
  }
  /** Currently active organization context (first membership by default). */
  orgId: string
  workosOrgId: string
  /** URL slug for org-scoped routing: /[orgSlug]/dashboard */
  orgSlug: string | null
  /** Derived product label for this org context. */
  productLabel: ProductLabel
  /** WorkOS seniority role inside the current org. */
  workosRole: "admin" | "member"
  /** Union of capability slugs granted by this membership's role bundle. */
  capabilities: readonly string[]
  /** Stripe Entitlements from WorkOS access token (populated when Stripe add-on is enabled). */
  entitlements?: readonly string[]
}

export class UnauthorizedError extends Error {
  readonly code: "no-session" | "missing-capability"
  constructor(code: "no-session" | "missing-capability", message?: string) {
    super(message ?? `Unauthorized: ${code}`)
    this.code = code
    this.name = "UnauthorizedError"
  }
}
