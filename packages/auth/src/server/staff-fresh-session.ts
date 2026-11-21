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
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  // Inviting someone into a workspace gives them a way in as well: an old
  // staff session must not bring an outsider into the staff workspace.
  "/organization/invite-member",
])

/**
 * Every session a request carries, as the auth server's request hook must
 * see them. A session sent as `Authorization: Bearer` is only turned into a
 * cookie by a plugin that runs after the hook, and it then replaces the
 * cookie the hook saw. So a request can carry two sessions, and the
 * endpoint may act for either: the guard is asked about both, never just
 * the first one it finds.
 */
export async function sessionsForRequestHook<S>(input: {
  fromCookie: () => Promise<S | null | undefined>
  headers: Headers | undefined
  fromHeaders: (headers: Headers) => Promise<S | null | undefined>
}): Promise<S[]> {
  const viaHeader = input.headers?.get("authorization")
    ? await input.fromHeaders(input.headers)
    : null
  const viaCookie = await input.fromCookie()
  return [viaHeader, viaCookie].filter(
    (session): session is NonNullable<typeof session> => Boolean(session)
  ) as S[]
}

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
