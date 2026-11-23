import { and, eq } from "drizzle-orm"
import { STAFF_DECISION_SIGN_IN_MAX_AGE_MS } from "@eleva/config/clinic-verification"
import { isRecentSignIn } from "@eleva/config/practice-closure"
import { auth, db } from "@eleva/db"

/**
 * Better Auth endpoints that hand a signed-in person another way in: a
 * linked sign-in account, an API key, a passkey. A staff decision needs a
 * session that started today (`requireStaffReviewer`); without this guard
 * an old staff session could mint itself a new one through any of them.
 */
export const NEW_CREDENTIAL_PATHS: ReadonlySet<string> = new Set([
  "/link-social",
  "/api-key/create",
  "/api-key/update",
  // Setting a password for an account (an admin action) is a way in too.
  "/admin/set-user-password",
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  // Inviting someone into a workspace gives them a way in as well: an old
  // staff session must not bring an outsider into the staff workspace.
  "/organization/invite-member",
])

async function isStaff(userId: string): Promise<boolean> {
  const [row] = await db()
    .select({ id: auth.member.id })
    .from(auth.member)
    .innerJoin(
      auth.organization,
      eq(auth.member.organizationId, auth.organization.id)
    )
    .where(
      and(eq(auth.member.userId, userId), eq(auth.organization.type, "staff"))
    )
    .limit(1)
  return Boolean(row)
}

/**
 * True when this request must be refused until the person signs in again:
 * it asks for a new credential, the session is older than the staff window
 * and the person works in a staff workspace. Everyone else (an expert
 * connecting a calendar, a member adding a passkey) is never asked.
 */
export async function staffMustSignInAgain(
  input: {
    path: string
    userId: string
    sessionCreatedAt: Date | string | null | undefined
    now?: Date
  },
  deps: { isStaff?: (userId: string) => Promise<boolean> } = {}
): Promise<boolean> {
  if (!NEW_CREDENTIAL_PATHS.has(input.path)) return false
  const createdAt = input.sessionCreatedAt
    ? new Date(input.sessionCreatedAt)
    : null
  const startedAt =
    createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null
  // A session with no readable start is treated as old.
  if (
    isRecentSignIn(
      startedAt,
      input.now ?? new Date(),
      STAFF_DECISION_SIGN_IN_MAX_AGE_MS
    )
  ) {
    return false
  }
  return (deps.isStaff ?? isStaff)(input.userId)
}

/** What the auth server answers when a staff member must sign in again. */
export const STEP_UP_REQUIRED = "STEP_UP_REQUIRED"

/**
 * What the request hook answers for a path that hands out a new credential:
 * go on, 401 (`no-session`) or 403 STEP_UP_REQUIRED (`sign-in-again`).
 */
export type NewCredentialVerdict = "allow" | "no-session" | "sign-in-again"

type HookSession = {
  user: { id: string }
  session: { createdAt: Date | string }
}

/**
 * The whole decision the request hook makes, in one place so it can be
 * tested without an auth server. For a path that hands out a new credential:
 *
 * - every session the request carries is asked, and one old staff session
 *   is enough to refuse. A session sent as `Authorization: Bearer` is only
 *   turned into a cookie by a plugin that runs after the hook, and it then
 *   replaces the cookie the hook saw: a request can carry two sessions, and
 *   the endpoint may act for either.
 * - a cookie or a bearer token that the session store no longer knows
 *   (signed out elsewhere, banned, password reset) is refused outright. The
 *   endpoint behind the hook may read the browser's 5-minute copy of that
 *   session, so the hook must not wave it through as "nobody".
 */
export async function newCredentialVerdict<S extends HookSession>(
  input: {
    path: string
    /** Whether the request sends a session cookie. */
    hasSessionCookie: boolean
    fromCookie: () => Promise<S | null | undefined>
    headers: Headers | undefined
    fromHeaders: (headers: Headers) => Promise<S | null | undefined>
    now?: Date
  },
  deps: { isStaff?: (userId: string) => Promise<boolean> } = {}
): Promise<NewCredentialVerdict> {
  if (!NEW_CREDENTIAL_PATHS.has(input.path)) return "allow"
  const viaHeader =
    input.headers?.get("authorization") && input.headers
      ? ((await input.fromHeaders(input.headers)) ?? null)
      : undefined
  const viaCookie = (await input.fromCookie()) ?? null
  if (viaHeader === null || (input.hasSessionCookie && !viaCookie)) {
    return "no-session"
  }
  for (const current of [viaHeader, viaCookie]) {
    if (!current) continue
    if (
      await staffMustSignInAgain(
        {
          path: input.path,
          userId: current.user.id,
          sessionCreatedAt: current.session.createdAt,
          now: input.now,
        },
        deps
      )
    ) {
      return "sign-in-again"
    }
  }
  return "allow"
}
