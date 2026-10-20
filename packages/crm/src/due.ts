import { createHash } from "node:crypto"
import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm"
import { resolveExpertWorkspaceBase } from "@eleva/auth/org-routing"
import { withPlatformAdminContext } from "@eleva/db"
import { member, organization, user } from "@eleva/db/schema/auth"
import { crmFollowUps } from "@eleva/db/schema"
import { getEmailTranslations } from "@eleva/email/i18n"
import {
  sendNotification,
  toEmailLocale,
  type SendNotificationInput,
  type SendNotificationResult,
} from "@eleva/notifications"

const DUE_SCAN_LIMIT = 500

export type DueFollowUpRow = {
  id: string
  orgId: string
  orgSlug: string
  authorId: string
  authorLocale: string | null
}

export type DueFollowUpDigest = {
  orgId: string
  orgSlug: string
  authorId: string
  authorLocale: string | null
  followUpIds: string[]
}

export type NotifyDueFollowUpsDeps = {
  listDue?: (input: { now: Date; limit: number }) => Promise<DueFollowUpRow[]>
  send?: (input: SendNotificationInput) => Promise<SendNotificationResult>
  markNotified?: (input: { ids: string[]; now: Date }) => Promise<void>
}

/**
 * Open, un-notified follow-ups due by `now` whose author is still a
 * member of the org. Cross-tenant read: ids and routing only, never notes.
 */
async function listDueFollowUps(input: {
  now: Date
  limit: number
}): Promise<DueFollowUpRow[]> {
  return withPlatformAdminContext((tx) =>
    tx
      .select({
        id: crmFollowUps.id,
        orgId: crmFollowUps.orgId,
        orgSlug: organization.slug,
        authorId: crmFollowUps.createdBy,
        authorLocale: user.locale,
      })
      .from(crmFollowUps)
      .innerJoin(organization, eq(organization.id, crmFollowUps.orgId))
      .innerJoin(
        member,
        and(
          eq(member.organizationId, crmFollowUps.orgId),
          eq(member.userId, crmFollowUps.createdBy)
        )
      )
      .innerJoin(user, eq(user.id, crmFollowUps.createdBy))
      .where(
        and(
          isNull(crmFollowUps.doneAt),
          isNull(crmFollowUps.notifiedAt),
          lte(crmFollowUps.dueAt, input.now)
        )
      )
      .orderBy(asc(crmFollowUps.dueAt))
      .limit(input.limit)
  )
}

async function markFollowUpsNotified(input: {
  ids: string[]
  now: Date
}): Promise<void> {
  if (input.ids.length === 0) return
  await withPlatformAdminContext((tx) =>
    tx
      .update(crmFollowUps)
      .set({ notifiedAt: input.now })
      .where(
        and(
          inArray(crmFollowUps.id, input.ids),
          isNull(crmFollowUps.notifiedAt)
        )
      )
  )
}

/** One digest per (org, author). */
export function groupDueFollowUps(rows: DueFollowUpRow[]): DueFollowUpDigest[] {
  const digests = new Map<string, DueFollowUpDigest>()
  for (const row of rows) {
    const key = `${row.orgId}:${row.authorId}`
    const digest = digests.get(key)
    if (digest) {
      digest.followUpIds.push(row.id)
      continue
    }
    digests.set(key, {
      orgId: row.orgId,
      orgSlug: row.orgSlug,
      authorId: row.authorId,
      authorLocale: row.authorLocale,
      followUpIds: [row.id],
    })
  }
  return [...digests.values()]
}

/** Stable across retries for the same set of due follow-ups. */
export function dueDigestIdempotencyKey(digest: DueFollowUpDigest): string {
  const hash = createHash("sha256")
    .update([...digest.followUpIds].sort().join(","))
    .digest("hex")
    .slice(0, 32)
  return `crm-follow-ups-due:${digest.orgId}:${digest.authorId}:${hash}`
}

function isDelivered(result: SendNotificationResult): boolean {
  return result.deliveries.some(
    (delivery) => delivery.status === "sent" || delivery.status === "suppressed"
  )
}

/**
 * Hourly sweep: sends each follow-up author an in-app digest of their
 * due follow-ups, then stamps `notified_at` so each one notifies once.
 * The digest carries a count only — no member names or notes.
 */
export async function notifyDueFollowUps(
  input?: { now?: Date; limit?: number },
  deps: NotifyDueFollowUpsDeps = {}
): Promise<{ scanned: number; notified: number; errors: number }> {
  const now = input?.now ?? new Date()
  const listDue = deps.listDue ?? listDueFollowUps
  const send = deps.send ?? sendNotification
  const markNotified = deps.markNotified ?? markFollowUpsNotified

  const rows = await listDue({ now, limit: input?.limit ?? DUE_SCAN_LIMIT })
  let notified = 0
  let errors = 0
  for (const digest of groupDueFollowUps(rows)) {
    const copy = getEmailTranslations(toEmailLocale(digest.authorLocale)).crm
    const title = copy.followUpDueTitle
    try {
      const result = await send({
        kind: "crm.follow_up_due",
        orgId: digest.orgId,
        recipient: { userId: digest.authorId },
        ctx: {
          title,
          body: copy.followUpDueBody(digest.followUpIds.length),
          subject: title,
          html: "",
          href: `${resolveExpertWorkspaceBase(digest.orgSlug)}/crm`,
          data: { count: digest.followUpIds.length },
        },
        idempotencyKey: dueDigestIdempotencyKey(digest),
      })
      if (!isDelivered(result)) {
        errors += 1
        continue
      }
      await markNotified({ ids: digest.followUpIds, now })
      notified += digest.followUpIds.length
    } catch {
      console.error("[crm-follow-up-due] digest failed", {
        orgId: digest.orgId,
      })
      errors += 1
    }
  }
  return { scanned: rows.length, notified, errors }
}
