import { and, eq, inArray, isNull } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { auth, db, main } from "@eleva/db"

const PROVIDER_TO_SLUG = {
  google: "google-calendar",
  microsoft: "microsoft-calendar",
} as const

const CALENDAR_SCOPE_HINTS: Record<keyof typeof PROVIDER_TO_SLUG, string[]> = {
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
        const [existing] = await tx
          .select({
            id: main.expertIntegrations.id,
            authAccountId: main.expertIntegrations.authAccountId,
            accountIdentifier: main.expertIntegrations.accountIdentifier,
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
          existing.accountIdentifier === account.accountId
        ) {
          continue
        }

        if (existing) {
          await tx
            .update(main.expertIntegrations)
            .set({
              authAccountId: account.id,
              accountIdentifier: account.accountId,
              status: "connected",
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
            accountIdentifier: account.accountId,
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
