import type { OrgType } from "@eleva/db/schema"

export type { OrgType }

/**
 * Eleva product labels — derived from (org.type, membership role)
 * per identity-rbac-spec.md. NOT stored; computed at session-read time.
 */
export type ProductLabel =
  | "member"
  | "expert"
  | "team_admin"
  | "lecturer"
  | "staff"

export type MembershipRole = "admin" | "member"

export interface ElevaSession {
  user: {
    id: string
    email: string
    displayName?: string | null
    avatarUrl?: string | null
  }
  /** Currently active organization context (first membership by default). */
  orgId: string
  /** URL slug for org-scoped routing: /[orgSlug]/dashboard */
  orgSlug: string | null
  /** Derived product label for this org context. */
  productLabel: ProductLabel
  /** Eleva org type for the active organization. */
  orgType: OrgType
  /** Seniority inside the current org. Better Auth `owner` maps to `admin`. */
  membershipRole: MembershipRole
  /** How requireApiAuth resolved this identity. */
  authMode?: ApiAuthMode
  /** Union of capability slugs granted by this membership's role bundle. */
  capabilities: readonly string[]
  /** Stripe entitlements attached when a billing subscription is active. */
  entitlements?: readonly string[]
}

export type ApiAuthMode = "cookie" | "bearer" | "jwt" | "api-key"

export type UnauthorizedErrorCode =
  | "no-session"
  | "not-a-member"
  | "missing-capability"
  | "ambiguous-credentials"
  | "session-cookie-ambiguous"
  | "csrf-origin-mismatch"
  | "invalid-token"
  | "jwt-not-revocable"

export class UnauthorizedError extends Error {
  readonly code: UnauthorizedErrorCode
  constructor(code: UnauthorizedErrorCode, message?: string) {
    super(message ?? `Unauthorized: ${code}`)
    this.code = code
    this.name = "UnauthorizedError"
  }
}
