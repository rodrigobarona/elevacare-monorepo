import { and, eq, inArray } from "drizzle-orm"
import { withAudit, withPlatformAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import { deletePrivateDocument } from "@eleva/storage"
import {
  buildDsarDownloadUrl,
  dsarExport,
  DSAR_SIGNED_URL_TTL_SECONDS,
} from "./dsar-export"

const ACTIVE_DSAR_STATUSES = ["pending", "processing"] as const

export type DsarRequestView = {
  id: string
  status: (typeof main.dsarRequestStatusEnum.enumValues)[number]
  requestedAt: Date
  expiresAt: Date | null
  blobPathname: string | null
  completedAt: Date | null
}

export async function createDsarRequest(input: {
  userId: string
  orgId: string
}): Promise<{ id: string; reused: boolean }> {
  const [existing] = await withPlatformAdminContext((tx) =>
    tx
      .select({ id: main.dsarRequests.id })
      .from(main.dsarRequests)
      .where(
        and(
          eq(main.dsarRequests.userId, input.userId),
          inArray(main.dsarRequests.status, [...ACTIVE_DSAR_STATUSES])
        )
      )
      .limit(1)
  )
  if (existing) {
    return { id: existing.id, reused: true }
  }

  return withAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const [created] = await tx
        .insert(main.dsarRequests)
        .values({
          userId: input.userId,
          status: "pending",
        })
        .returning({ id: main.dsarRequests.id })
      const id = created!.id
      await ctx.emit({
        entity: "dsar_request",
        action: "requested",
        entityId: id,
        payload: {},
      })
      return { id, reused: false }
    }
  )
}

export async function getDsarRequestById(
  dsarId: string
): Promise<DsarRequestView | null> {
  const [row] = await withPlatformAdminContext((tx) =>
    tx
      .select({
        id: main.dsarRequests.id,
        status: main.dsarRequests.status,
        requestedAt: main.dsarRequests.requestedAt,
        expiresAt: main.dsarRequests.expiresAt,
        blobPathname: main.dsarRequests.blobPathname,
        completedAt: main.dsarRequests.completedAt,
      })
      .from(main.dsarRequests)
      .where(eq(main.dsarRequests.id, dsarId))
      .limit(1)
  )
  return row ?? null
}

export async function getDsarRequestForUser(
  userId: string,
  dsarId: string
): Promise<DsarRequestView | null> {
  const [row] = await withPlatformAdminContext((tx) =>
    tx
      .select({
        id: main.dsarRequests.id,
        status: main.dsarRequests.status,
        requestedAt: main.dsarRequests.requestedAt,
        expiresAt: main.dsarRequests.expiresAt,
        blobPathname: main.dsarRequests.blobPathname,
        completedAt: main.dsarRequests.completedAt,
      })
      .from(main.dsarRequests)
      .where(
        and(
          eq(main.dsarRequests.id, dsarId),
          eq(main.dsarRequests.userId, userId)
        )
      )
      .limit(1)
  )
  return row ?? null
}

export async function markDsarExpired(input: {
  userId: string
  orgId: string
  dsarId: string
}): Promise<void> {
  const existing = await getDsarRequestForUser(input.userId, input.dsarId)
  if (!existing) return
  if (existing.status === "expired" && !existing.blobPathname) return

  // Blob I/O stays outside withAudit — never vendor SDK calls in a DB tx.
  if (existing.blobPathname) {
    await deletePrivateDocument(existing.blobPathname)
  }

  await withAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      await tx
        .update(main.dsarRequests)
        .set({ status: "expired", blobPathname: null })
        .where(
          and(
            eq(main.dsarRequests.id, input.dsarId),
            eq(main.dsarRequests.userId, input.userId)
          )
        )
      await ctx.emit({
        entity: "dsar_request",
        action: "expired",
        entityId: input.dsarId,
        payload: {},
      })
    }
  )
}

export function dsarDownloadUrlIfReady(input: {
  apiBaseUrl: string
  request: DsarRequestView
}): string | undefined {
  if (input.request.status !== "ready" || !input.request.expiresAt) {
    return undefined
  }
  if (input.request.expiresAt.getTime() <= Date.now()) return undefined
  return buildDsarDownloadUrl({
    apiBaseUrl: input.apiBaseUrl,
    dsarId: input.request.id,
    expiresAt: input.request.expiresAt,
  })
}

export async function processDsarExport(input: {
  dsarId: string
  userId: string
  orgId: string
}): Promise<{ status: "ready" | "failed" | "skipped" }> {
  const existing = await getDsarRequestForUser(input.userId, input.dsarId)
  if (!existing) return { status: "skipped" }
  if (
    existing.status === "ready" &&
    existing.expiresAt &&
    existing.expiresAt.getTime() > Date.now()
  ) {
    return { status: "skipped" }
  }
  if (existing.status === "expired") {
    return { status: "skipped" }
  }

  const claimed = await withPlatformAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const [row] = await tx
        .update(main.dsarRequests)
        .set({ status: "processing" })
        .where(
          and(
            eq(main.dsarRequests.id, input.dsarId),
            eq(main.dsarRequests.userId, input.userId),
            inArray(main.dsarRequests.status, ["pending", "failed"])
          )
        )
        .returning({ id: main.dsarRequests.id })
      if (!row) return false
      await ctx.emit({
        entity: "dsar_request",
        action: "updated",
        entityId: input.dsarId,
        payload: { status: "processing" },
      })
      return true
    }
  )
  if (!claimed) return { status: "skipped" }

  try {
    const exported = await dsarExport(input.userId)
    await withPlatformAudit(
      { orgId: input.orgId, actorUserId: input.userId },
      async (tx, ctx) => {
        await tx
          .update(main.dsarRequests)
          .set({
            status: "ready",
            blobPathname: exported.blobUrl,
            expiresAt: exported.expiresAt,
            completedAt: new Date(),
          })
          .where(eq(main.dsarRequests.id, input.dsarId))
        await ctx.emit({
          entity: "dsar_request",
          action: "ready",
          entityId: input.dsarId,
          payload: {
            expiresAt: exported.expiresAt.toISOString(),
            ttlSeconds: DSAR_SIGNED_URL_TTL_SECONDS,
          },
        })
      }
    )
    return { status: "ready" }
  } catch (err) {
    await withPlatformAudit(
      { orgId: input.orgId, actorUserId: input.userId },
      async (tx, ctx) => {
        await tx
          .update(main.dsarRequests)
          .set({ status: "failed" })
          .where(eq(main.dsarRequests.id, input.dsarId))
        await ctx.emit({
          entity: "dsar_request",
          action: "failed",
          entityId: input.dsarId,
          payload: {
            message: err instanceof Error ? err.message : String(err),
          },
        })
      }
    )
    return { status: "failed" }
  }
}
