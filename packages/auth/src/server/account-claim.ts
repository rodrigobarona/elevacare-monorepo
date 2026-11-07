import { eq, or } from "drizzle-orm"
import { getSessionFromCtx } from "better-auth/api"
import { getPlatformAuditOrgId, withAudit } from "@eleva/audit"
import { auth } from "@eleva/db"
import { findDefaultOrganizationId } from "../provision-personal-space"

type AuthEndpointContext = Parameters<typeof getSessionFromCtx>[0]

export const ACCOUNT_NOT_LINKED = "account_not_linked"

/**
 * Unsigned claims the guard approved on an unverified row, keyed by user and
 * provider. The account-create hook consumes the entry in the same request;
 * a row that turns verified between the two steps then aborts the link
 * instead of attaching the provider without the owner. Stale entries (a
 * link that failed before the hook) are swept when new ones are recorded;
 * an entry is honoured until consumed, so a slow request still purges.
 */
const PENDING_CLAIM_SWEEP_MS = 10 * 60_000
const pendingClaims = new Map<string, number>()

function claimKey(userId: string, providerId: string): string {
  return `${userId}:${providerId}`
}

function recordPendingClaim(userId: string, providerId: string): void {
  const now = Date.now()
  for (const [key, recordedAt] of pendingClaims) {
    if (now - recordedAt > PENDING_CLAIM_SWEEP_MS) pendingClaims.delete(key)
  }
  pendingClaims.set(claimKey(userId, providerId), now)
}

function takePendingClaim(userId: string, providerId: string): boolean {
  return pendingClaims.delete(claimKey(userId, providerId))
}

/** `null` when signed out. A failed lookup rethrows so callers fail closed. */
async function signedInUserId(
  ctx: AuthEndpointContext
): Promise<string | null> {
  const session = await getSessionFromCtx(ctx)
  return session?.user.id ?? null
}

async function findUser(
  ctx: AuthEndpointContext,
  userId: string
): Promise<{ id: string; emailVerified: boolean } | null> {
  const user = await ctx.context.internalAdapter.findUserById(userId)
  return user
    ? { id: user.id, emailVerified: Boolean(user.emailVerified) }
    : null
}

const EMAIL_NOT_VERIFIED = {
  error: "email_not_verified",
  errorDescription:
    "Your provider has not confirmed this email address. Confirm it with the provider, or sign in with a sign-in link.",
}

const NOT_LINKED = {
  error: ACCOUNT_NOT_LINKED,
  errorDescription:
    "Sign in to your existing account first, then connect this provider in Settings.",
}

/**
 * `user.validateUserInfo` gate (SEC2-01/02). A provider sign-in may not
 * attach a new identity to an existing account unless the owner is signed
 * in (Settings → Connect Google). The one exception is an unverified row
 * whose email the provider itself has verified: that proof of email claims
 * the row, and `purgeBeforeClaim` wipes what was enrolled before it.
 */
export async function guardAccountLink(
  data: {
    user: { id?: unknown; emailVerified?: unknown }
    source: {
      action: string
      method: string
      oauth?: { providerId?: string }
      sso?: { providerId?: string }
    }
  },
  ctx: AuthEndpointContext
): Promise<{ error: string; errorDescription: string } | undefined> {
  const viaProvider =
    data.source.method === "oauth" || data.source.method.startsWith("sso-")
  if (data.source.action === "create-user") {
    // No account is created from an unverified provider email, so an
    // unverified row never holds a session (password sign-in already
    // requires verification and a magic link verifies). That keeps a claim
    // from racing anything the old row could enroll.
    if (viaProvider && data.user.emailVerified !== true)
      return EMAIL_NOT_VERIFIED
    return
  }
  if (data.source.action !== "link-account") return
  const userId = typeof data.user.id === "string" ? data.user.id : null
  if (!userId) return
  const user = await findUser(ctx, userId)
  if (!user) return
  const ownerSignedIn = await signedInUserId(ctx)
    .then((id) => id === userId)
    .catch(() => false)
  if (ownerSignedIn) return
  if (user.emailVerified || data.user.emailVerified !== true) return NOT_LINKED
  const providerId =
    data.source.oauth?.providerId ?? data.source.sso?.providerId
  if (!providerId) return NOT_LINKED
  recordPendingClaim(userId, providerId)
  return
}

class ClaimRaced extends Error {}

/**
 * `databaseHooks.account.create.before`. Runs only for a claim that
 * `guardAccountLink` approved in the same request: a provider-verified
 * email claiming an unverified row without the owner signed in. Everything
 * enrolled before
 * verification is treated as attacker-controlled. Sessions are revoked,
 * then other logins (password, Google, Microsoft), passkeys, two-factor
 * secrets and backup codes and API keys are removed in one audited write
 * (`user.claimed`, always emitted), then sessions are revoked again so
 * nothing enrolled from a session opened in between survives. Throws, which
 * aborts the link, if the audited purge fails or if the row became
 * verified while the claim was in flight.
 */
export async function purgeBeforeClaim(
  account: { userId: string; providerId: string },
  ctx: AuthEndpointContext | null
): Promise<void> {
  if (!ctx || account.providerId === "credential") return
  // Only a claim the guard approved in this request purges. New OAuth
  // users, owner-initiated links and returning sign-ins never record one.
  if (!takePendingClaim(account.userId, account.providerId)) return
  const user = await findUser(ctx, account.userId)
  if (!user) return
  if (user.emailVerified) {
    throw new ClaimRaced("account claim raced verification")
  }

  const orgId =
    (await findDefaultOrganizationId(user.id)) ?? getPlatformAuditOrgId()
  if (!orgId) {
    throw new Error("account claim: no organization to audit the purge")
  }

  // Revoke first: passkey, two-factor and password changes need a live
  // session checked against storage, not the cookie cache.
  await ctx.context.internalAdapter.deleteUserSessions(user.id)
  await withAudit({ orgId, actorUserId: user.id }, async (tx, audit) => {
    const [current] = await tx
      .select({ emailVerified: auth.user.emailVerified })
      .from(auth.user)
      .where(eq(auth.user.id, user.id))
      .for("update")
    if (!current || current.emailVerified) {
      throw new ClaimRaced("account claim raced verification")
    }
    const logins = await tx
      .delete(auth.account)
      .where(eq(auth.account.userId, user.id))
      .returning({ providerId: auth.account.providerId })
    const passkeys = await tx
      .delete(auth.passkey)
      .where(eq(auth.passkey.userId, user.id))
      .returning({ id: auth.passkey.id })
    const factors = await tx
      .delete(auth.twoFactor)
      .where(eq(auth.twoFactor.userId, user.id))
      .returning({ id: auth.twoFactor.id })
    const apiKeys = await tx
      .delete(auth.apikey)
      .where(
        or(
          eq(auth.apikey.userId, user.id),
          eq(auth.apikey.referenceId, user.id)
        )
      )
      .returning({ id: auth.apikey.id })
    await tx
      .update(auth.user)
      .set({ twoFactorEnabled: false })
      .where(eq(auth.user.id, user.id))
    await audit.emit({
      entity: "user",
      action: "claimed",
      entityId: user.id,
      payload: {
        providerId: account.providerId,
        removedLogins: logins.map((row) => row.providerId),
        removedPasskeys: passkeys.length,
        removedTwoFactor: factors.length,
        removedApiKeys: apiKeys.length,
        sessionsRevoked: true,
      },
    })
  })
  await ctx.context.internalAdapter.deleteUserSessions(user.id)
}
