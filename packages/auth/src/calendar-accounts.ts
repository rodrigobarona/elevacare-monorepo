import { and, eq, inArray, isNull } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { auth, db, main } from "@eleva/db"

const PROVIDER_TO_SLUG = {
  google: "google-calendar",
  microsoft: "microsoft-calendar",
} as const

const CALENDAR_SCOPE_HINTS: Record<keyof typeof PROVIDER_TO_SLUG, string[]> = {
  // `calendar.events` also matches the narrower `calendar.events.owned`.
  google: ["calendar.readonly", "calendar.events"],
  microsoft: ["Calendars.ReadWrite"],
}

function isCalendarProvider(
  providerId: string
): providerId is keyof typeof PROVIDER_TO_SLUG {
  return providerId === "google" || providerId === "microsoft"
}

function hasCalendarScope(providerId: string, scope: string | null): boolean {
  if (!isCalendarProvider(providerId)) return false
  const granted = scope ?? ""
  return CALENDAR_SCOPE_HINTS[providerId].some((hint) => granted.includes(hint))
}

/**
 * The address the person signed in with, read from the provider's ID token
 * (stored unencrypted by Better Auth; only access and refresh tokens are).
 * The calendar card shows it instead of the provider's numeric account ID.
 * Microsoft accounts made with another provider's email report an internal
 * `outlook_…@outlook.com` mailbox elsewhere, so the token is the reliable
 * source. Not verified here: the token came from Eleva's own callback.
 */
export function emailFromIdToken(idToken: string | null): string | null {
  const payload = idToken?.split(".")[1]
  if (!payload) return null
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { email?: unknown; preferred_username?: unknown }
    for (const value of [claims.email, claims.preferred_username]) {
      if (typeof value === "string" && value.includes("@")) return value
    }
  } catch {
    // Not a JWT; fall back to the account ID.
  }
  return null
}

export async function syncExpertCalendarAccounts(input: {
  orgId: string
  expertProfileId: string
  userId: string
  actorUserId?: string
}): Promise<void> {
  const accounts = await db()
    .select({
      id: auth.account.id,
      providerId: auth.account.providerId,
      accountId: auth.account.accountId,
      scope: auth.account.scope,
      idToken: auth.account.idToken,
    })
    .from(auth.account)
    .where(
      and(
        eq(auth.account.userId, input.userId),
        inArray(auth.account.providerId, ["google", "microsoft"])
      )
    )

  const linkable = accounts.filter((row) =>
    hasCalendarScope(row.providerId, row.scope)
  )
  if (linkable.length === 0) return

  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId ?? input.userId },
    async (tx, ctx) => {
      const linked: Array<{
        id: string
        slug: string
        authAccountId: string
      }> = []

      for (const account of linkable) {
        if (!isCalendarProvider(account.providerId)) continue
        const slug = PROVIDER_TO_SLUG[account.providerId]
        const identifier =
          emailFromIdToken(account.idToken) ?? account.accountId
        const [existing] = await tx
          .select({
            id: main.expertIntegrations.id,
            authAccountId: main.expertIntegrations.authAccountId,
            accountIdentifier: main.expertIntegrations.accountIdentifier,
            status: main.expertIntegrations.status,
          })
          .from(main.expertIntegrations)
          .where(
            and(
              eq(
                main.expertIntegrations.expertProfileId,
                input.expertProfileId
              ),
              eq(main.expertIntegrations.slug, slug),
              isNull(main.expertIntegrations.deletedAt)
            )
          )
          .limit(1)

        if (
          existing &&
          existing.authAccountId === account.id &&
          existing.accountIdentifier === identifier &&
          existing.status === "connected"
        ) {
          continue
        }

        if (existing) {
          await tx
            .update(main.expertIntegrations)
            .set({
              authAccountId: account.id,
              accountIdentifier: identifier,
              status: "connected",
              lastErrorCode: null,
              connectedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(main.expertIntegrations.id, existing.id))
          linked.push({
            id: existing.id,
            slug,
            authAccountId: account.id,
          })
          continue
        }

        const inserted = await tx
          .insert(main.expertIntegrations)
          .values({
            orgId: input.orgId,
            expertProfileId: input.expertProfileId,
            category: "calendar",
            slug,
            connectType: "pipes",
            authAccountId: account.id,
            accountIdentifier: identifier,
            status: "connected",
            connectedAt: new Date(),
          })
          .returning({ id: main.expertIntegrations.id })
        const created = inserted[0]
        if (created) {
          linked.push({
            id: created.id,
            slug,
            authAccountId: account.id,
          })
        }
      }

      await ctx.emit({
        entity: "expert_integration_credential",
        action: "connected",
        entityId: linked[0]?.id ?? input.expertProfileId,
        payload: linked.length > 0 ? { accounts: linked } : { unchanged: true },
      })
    }
  )
}

/**
 * Flags a calendar integration whose provider token was revoked or expired
 * so the expert sees a reconnect prompt; `syncExpertCalendarAccounts`
 * restores `connected` on the next successful link.
 */
export async function markCalendarIntegrationExpired(input: {
  orgId: string
  integrationId: string
  errorCode: string
  /** `connectedAt` the failed lookup saw; a reconnect since then wins. */
  observedConnectedAt: Date | null
}): Promise<boolean> {
  return withAudit(
    { orgId: input.orgId, actorUserId: null },
    async (tx, ctx) => {
      const [updated] = await tx
        .update(main.expertIntegrations)
        .set({
          status: "expired",
          lastErrorCode: input.errorCode.slice(0, 64),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(main.expertIntegrations.id, input.integrationId),
            eq(main.expertIntegrations.orgId, input.orgId),
            eq(main.expertIntegrations.status, "connected"),
            input.observedConnectedAt
              ? eq(
                  main.expertIntegrations.connectedAt,
                  input.observedConnectedAt
                )
              : isNull(main.expertIntegrations.connectedAt)
          )
        )
        .returning({ id: main.expertIntegrations.id })
      await ctx.emit({
        entity: "expert_integration_credential",
        action: "expired",
        entityId: input.integrationId,
        payload: { errorCode: input.errorCode, changed: Boolean(updated) },
      })
      return Boolean(updated)
    }
  )
}
