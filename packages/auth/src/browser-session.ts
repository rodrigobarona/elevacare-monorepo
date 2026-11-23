/**
 * Reading what the auth server says about the session a browser carries.
 * Pure, so that each rule here has a test: these answers decide whether a
 * page of health or staff data stays on a screen.
 */

/** The session this browser carries, as the auth server reports it. */
export interface BrowserSession {
  userId: string
  email: string
  /** The workspace the session is working in, if it has chosen one. */
  activeOrganizationId: string | null
  /** When the person signed in, or null when it cannot be read. */
  startedAt: Date | null
}

/**
 * The answer of `getSession`, read. `null` only when the server said the
 * browser is signed out (its answer carries no data at all). `undefined`
 * for every answer that cannot be read as a session: a caller must not
 * take that for "signed out", and so must not act on it.
 */
export function browserSessionFrom(answer: {
  data?: unknown
  error?: unknown
}): BrowserSession | null | undefined {
  if (answer.error) return undefined
  if (answer.data === null) return null
  const data = answer.data as
    | { session?: Record<string, unknown>; user?: Record<string, unknown> }
    | undefined
  const session = data?.session
  const user = data?.user
  if (!session || !user) return undefined
  if (typeof user.id !== "string" || typeof user.email !== "string") {
    return undefined
  }
  const started =
    typeof session.createdAt === "string" || session.createdAt instanceof Date
      ? new Date(session.createdAt)
      : null
  return {
    userId: user.id,
    email: user.email,
    activeOrganizationId:
      typeof session.activeOrganizationId === "string"
        ? session.activeOrganizationId
        : null,
    startedAt: started && !Number.isNaN(started.getTime()) ? started : null,
  }
}

/**
 * Whether the sign-in link sent to `email` has been used: the browser now
 * carries a sign-in of that person that it did not carry when the link
 * was sent.
 *
 * `before` is the start of the sign-in the browser carried then (`null`
 * for signed out). When that could not be read (`undefined`), the link's
 * own time decides: only a sign-in that began after the link was sent
 * counts, so a person who was signed in all along is not sent on.
 */
export function signInLinkWasUsed(input: {
  now: BrowserSession | null | undefined
  email: string
  before: number | null | undefined
  linkSentAt: number
}): boolean {
  const { now, email, before, linkSentAt } = input
  if (!now || now.email.toLowerCase() !== email.trim().toLowerCase()) {
    return false
  }
  const started = now.startedAt?.getTime() ?? null
  if (before === undefined) return started !== null && started >= linkSentAt
  return started !== before
}

/**
 * Whether a page drawn for one reviewer may stay on screen after the
 * browser brought it back: only for the same person in the same staff
 * workspace. Signed out, someone else, or another workspace: no. When the
 * session could not be read (`undefined`) the page stays: that is "could
 * not tell", not "signed out".
 */
export function sameReviewer(
  now: BrowserSession | null | undefined,
  reviewer: { id: string; orgId: string }
): boolean {
  if (now === undefined) return true
  return (
    now !== null &&
    now.userId === reviewer.id &&
    now.activeOrganizationId === reviewer.orgId
  )
}
