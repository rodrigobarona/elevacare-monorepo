import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withOrgAndUserContext } from "@eleva/db"

export class InboxNotFoundError extends Error {
  constructor() {
    super("inbox notification not found")
    this.name = "InboxNotFoundError"
  }
}

export type InboxItem = {
  id: string
  kind: string
  title: string
  body: string
  href: string | null
  readAt: string | null
  createdAt: string
}

export type ListInboxResult = {
  items: InboxItem[]
  unreadCount: number
}

function toItem(row: typeof main.notifications.$inferSelect): InboxItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listInbox(input: {
  userId: string
  orgId: string
  unreadOnly?: boolean
  limit?: number
}): Promise<ListInboxResult> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)
  return withOrgAndUserContext(input.orgId, input.userId, async (tx) => {
    const unread = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(main.notifications)
      .where(
        and(
          eq(main.notifications.userId, input.userId),
          isNull(main.notifications.readAt)
        )
      )
    const rows = await tx
      .select()
      .from(main.notifications)
      .where(
        input.unreadOnly
          ? and(
              eq(main.notifications.userId, input.userId),
              isNull(main.notifications.readAt)
            )
          : eq(main.notifications.userId, input.userId)
      )
      .orderBy(desc(main.notifications.createdAt))
      .limit(limit)
    return {
      items: rows.map(toItem),
      unreadCount: Number(unread[0]?.count ?? 0),
    }
  })
}

export async function markInboxRead(input: {
  userId: string
  orgId: string
  notificationId: string
}): Promise<{ id: string; readAt: string } | null> {
  return withAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const now = new Date()
      const [row] = await tx
        .update(main.notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(main.notifications.id, input.notificationId),
            eq(main.notifications.userId, input.userId),
            isNull(main.notifications.readAt)
          )
        )
        .returning({
          id: main.notifications.id,
          readAt: main.notifications.readAt,
        })
      if (row?.readAt) {
        await ctx.emit({
          entity: "notification",
          action: "updated",
          entityId: input.notificationId,
          payload: { read: true, applied: true },
        })
        return { id: row.id, readAt: row.readAt.toISOString() }
      }
      const [existing] = await tx
        .select({
          id: main.notifications.id,
          readAt: main.notifications.readAt,
        })
        .from(main.notifications)
        .where(
          and(
            eq(main.notifications.id, input.notificationId),
            eq(main.notifications.userId, input.userId)
          )
        )
        .limit(1)
      if (!existing) {
        throw new InboxNotFoundError()
      }
      await ctx.emit({
        entity: "notification",
        action: "updated",
        entityId: input.notificationId,
        payload: { read: true, applied: false },
      })
      if (!existing.readAt) {
        throw new InboxNotFoundError()
      }
      return { id: existing.id, readAt: existing.readAt.toISOString() }
    }
  )
}

export async function markInboxReadAll(input: {
  userId: string
  orgId: string
}): Promise<{ updated: number }> {
  return withAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const now = new Date()
      const updated = await tx
        .update(main.notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(main.notifications.userId, input.userId),
            isNull(main.notifications.readAt)
          )
        )
        .returning({ id: main.notifications.id })
      await ctx.emit({
        entity: "inbox",
        action: "updated",
        entityId: input.userId,
        payload: { readAll: true, count: updated.length },
      })
      return { updated: updated.length }
    }
  )
}
