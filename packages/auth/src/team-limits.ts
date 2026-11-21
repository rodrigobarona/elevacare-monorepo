/**
 * Limits shared by the clinic team rules (`team-members.ts`) and the
 * Better Auth organization plugin (`server/auth.ts`).
 */

/** An invitation is valid for 7 days (Phase 11 scope). */
export const TEAM_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Members plus pending invitations in one organization. */
export const TEAM_MEMBER_LIMIT = 200

/**
 * A clinic emails one address at most once in eight hours (three times a
 * day), whatever happened to its earlier invitations, so inviting cannot
 * be used to flood someone who never asked to hear from the clinic and may
 * have no account to decline from.
 */
export const TEAM_INVITATION_RESEND_COOLDOWN_MS = 8 * 60 * 60 * 1000

/**
 * After someone declines a clinic's invitation, that clinic does not invite
 * the same address again for at least this long: declining has to mean
 * something to a person who may not even have an account to manage it
 * from. Counted from when the declined invitation would have expired (the
 * moment of the decline is not stored), so up to seven days longer.
 */
export const TEAM_INVITATION_DECLINE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Addresses one clinic invites in 24 hours. Inviting and withdrawing does
 * not get around it: every invitation sent counts, whatever became of it.
 */
export const TEAM_INVITATIONS_PER_DAY = 50

/**
 * Error code when Better Auth's own invite, cancel, remove or role
 * endpoint is called for a clinic: use `/teams/{teamId}/…` instead.
 */
export const TEAM_MEMBERS_API_REQUIRED = "TEAM_MEMBERS_API_REQUIRED"

/**
 * A session can run on after its booked end (the join link works for 30
 * minutes more, `@eleva/video` `JOIN_TRAIL_MS`). A clinician is not removed
 * from a clinic while one of their sessions may still be running.
 */
export const TEAM_SESSION_TRAIL_MS = 30 * 60 * 1000
