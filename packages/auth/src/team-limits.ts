/**
 * Limits shared by the clinic team rules (`team-members.ts`) and the
 * Better Auth organization plugin (`server/auth.ts`).
 */

/** An invitation is valid for 7 days (Phase 11 scope). */
export const TEAM_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Members plus pending invitations in one organization. */
export const TEAM_MEMBER_LIMIT = 200

/**
 * A clinic emails one address at most once a minute, whatever happened to
 * its earlier invitations, so inviting cannot be used to flood someone who
 * never asked to hear from the clinic.
 */
export const TEAM_INVITATION_RESEND_COOLDOWN_MS = 60 * 1000

/**
 * Error code when Better Auth's own invite, cancel, remove or role
 * endpoint is called for a clinic: use `/teams/{teamId}/…` instead.
 */
export const TEAM_MEMBERS_API_REQUIRED = "TEAM_MEMBERS_API_REQUIRED"
