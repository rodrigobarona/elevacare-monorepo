import { and, eq, isNull } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { withOrgAndUserContext, withPlatformAdminContext } from "@eleva/db"
import { bookings, sessionDocuments } from "@eleva/db/schema"
import { decryptRecordFields, encryptRecordFields } from "@eleva/encryption"
import {
  isSessionDocumentPathname,
  sessionDocumentPrefix,
} from "./document-path"
import {
  mintDocumentUrlGrant,
  sessionDocumentDownloadPath,
} from "./document-url-grant"
import { SessionDocumentError } from "./errors"

export const SESSION_DOCUMENT_SCOPES = ["expert_only", "shared"] as const

export type SessionDocumentScope = (typeof SESSION_DOCUMENT_SCOPES)[number]

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export type SessionDocumentMime = (typeof ALLOWED_MIME)[number]

export type SessionDocumentView = {
  id: string
  scope: SessionDocumentScope
  mime: SessionDocumentMime
  sizeBytes: number
  originalName: string
  uploadedAt: string
}

export type SessionDocumentDownload = {
  url: string
  expiresAt: string
}

type BookingRow = {
  id: string
  orgId: string
  expertUserId: string
  memberUserId: string | null
}

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIME)

function isAllowedMime(value: string): value is SessionDocumentMime {
  return ALLOWED_MIME_SET.has(value)
}

const MAX_BYTES = 10 * 1024 * 1024

function isScope(value: string): value is SessionDocumentScope {
  return (SESSION_DOCUMENT_SCOPES as readonly string[]).includes(value)
}

async function loadBooking(bookingId: string): Promise<BookingRow | null> {
  const [row] = await withPlatformAdminContext((tx) =>
    tx
      .select({
        id: bookings.id,
        orgId: bookings.orgId,
        expertUserId: bookings.expertUserId,
        memberUserId: bookings.memberUserId,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)
  )
  return row ?? null
}

function actorRole(
  booking: BookingRow,
  actorUserId: string
): "expert" | "member" {
  if (actorUserId === booking.expertUserId) return "expert"
  if (booking.memberUserId && actorUserId === booking.memberUserId) {
    return "member"
  }
  throw new SessionDocumentError("FORBIDDEN")
}

async function decryptMetadata(
  orgId: string,
  row: typeof sessionDocuments.$inferSelect
): Promise<string> {
  const plain = await decryptRecordFields(
    orgId,
    { metadata: row.metadataEncrypted },
    { recordId: row.id }
  )
  try {
    const parsed = JSON.parse(plain.metadata ?? "{}") as {
      originalName?: unknown
    }
    return typeof parsed.originalName === "string"
      ? parsed.originalName
      : "file"
  } catch {
    return "file"
  }
}

function toView(
  row: typeof sessionDocuments.$inferSelect,
  originalName: string
): SessionDocumentView {
  if (!isAllowedMime(row.mime)) {
    throw new SessionDocumentError("INVALID_PATHNAME")
  }
  return {
    id: row.id,
    scope: row.scope,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    originalName,
    uploadedAt: row.createdAt.toISOString(),
  }
}

export function documentUploadPrefix(booking: {
  orgId: string
  memberUserId: string | null
  id: string
}): string {
  return sessionDocumentPrefix({
    orgId: booking.orgId,
    memberUserId: booking.memberUserId,
    bookingId: booking.id,
  })
}

export async function requireDocumentUploader(input: {
  bookingId: string
  actorUserId: string
}): Promise<BookingRow> {
  const booking = await loadBooking(input.bookingId)
  if (!booking) throw new SessionDocumentError("NOT_FOUND")
  actorRole(booking, input.actorUserId)
  return booking
}

export async function listSessionDocuments(input: {
  bookingId: string
  actorUserId: string
}): Promise<SessionDocumentView[]> {
  const booking = await loadBooking(input.bookingId)
  if (!booking) throw new SessionDocumentError("NOT_FOUND")
  const role = actorRole(booking, input.actorUserId)
  const rows = await withOrgAndUserContext(
    booking.orgId,
    input.actorUserId,
    (tx) =>
      tx
        .select()
        .from(sessionDocuments)
        .where(
          and(
            eq(sessionDocuments.orgId, booking.orgId),
            eq(sessionDocuments.bookingId, booking.id),
            isNull(sessionDocuments.deletedAt)
          )
        )
  )
  const visible =
    role === "member" ? rows.filter((row) => row.scope === "shared") : rows
  const views: SessionDocumentView[] = []
  for (const row of visible) {
    views.push(toView(row, await decryptMetadata(booking.orgId, row)))
  }
  return views
}

export async function completeSessionDocument(input: {
  bookingId: string
  actorUserId: string
  pathname: string
  url: string
  mime: string
  sizeBytes: number
  scope: string
  originalName: string
}): Promise<SessionDocumentView> {
  const booking = await loadBooking(input.bookingId)
  if (!booking) throw new SessionDocumentError("NOT_FOUND")
  const role = actorRole(booking, input.actorUserId)
  if (!isScope(input.scope)) throw new SessionDocumentError("SCOPE_FORBIDDEN")
  const scope = input.scope
  if (role === "member" && scope !== "shared") {
    throw new SessionDocumentError("SCOPE_FORBIDDEN")
  }
  if (!isAllowedMime(input.mime)) {
    throw new SessionDocumentError("INVALID_PATHNAME")
  }
  const mime = input.mime
  if (
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > MAX_BYTES
  ) {
    throw new SessionDocumentError("INVALID_PATHNAME")
  }
  const prefix = documentUploadPrefix({
    orgId: booking.orgId,
    memberUserId: booking.memberUserId,
    id: booking.id,
  })
  if (!isSessionDocumentPathname(input.pathname, prefix)) {
    throw new SessionDocumentError("INVALID_PATHNAME")
  }
  const originalName = input.originalName.trim().slice(0, 200)
  if (!originalName) throw new SessionDocumentError("INVALID_PATHNAME")

  const id = crypto.randomUUID()
  const sealed = await encryptRecordFields(
    booking.orgId,
    { metadata: JSON.stringify({ originalName }) },
    { recordId: id }
  )
  const metadataEncrypted = sealed.metadata
  if (metadataEncrypted == null) {
    throw new Error("session document encryption failed")
  }

  return withAudit(
    { orgId: booking.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const inserted = (
        await tx
          .insert(sessionDocuments)
          .values({
            id,
            orgId: booking.orgId,
            memberUserId: booking.memberUserId,
            bookingId: booking.id,
            blobPathname: input.pathname,
            blobUrl: input.url,
            mime,
            sizeBytes: input.sizeBytes,
            metadataEncrypted,
            scope,
            uploadedBy: input.actorUserId,
          })
          .returning()
      )[0]
      if (!inserted) throw new SessionDocumentError("NOT_FOUND")
      await ctx.emit({
        entity: "session_document",
        action: "uploaded",
        entityId: id,
        payload: { bookingId: booking.id, scope },
      })
      return toView(inserted, originalName)
    }
  )
}

export async function mintSessionDocumentUrl(input: {
  bookingId: string
  documentId: string
  actorUserId: string
  apiBase: string
  secret?: string
  now?: Date
}): Promise<SessionDocumentDownload> {
  const booking = await loadBooking(input.bookingId)
  if (!booking) throw new SessionDocumentError("NOT_FOUND")
  const role = actorRole(booking, input.actorUserId)
  const [row] = await withOrgAndUserContext(
    booking.orgId,
    input.actorUserId,
    (tx) =>
      tx
        .select()
        .from(sessionDocuments)
        .where(
          and(
            eq(sessionDocuments.id, input.documentId),
            eq(sessionDocuments.orgId, booking.orgId),
            eq(sessionDocuments.bookingId, booking.id),
            isNull(sessionDocuments.deletedAt)
          )
        )
        .limit(1)
  )
  if (!row) throw new SessionDocumentError("NOT_FOUND")
  if (role === "member" && row.scope !== "shared") {
    throw new SessionDocumentError("FORBIDDEN")
  }

  const { token, expiresAt } = mintDocumentUrlGrant({
    bookingId: booking.id,
    documentId: row.id,
    actorUserId: input.actorUserId,
    secret: input.secret,
    now: input.now,
  })

  await withAudit(
    { orgId: booking.orgId, actorUserId: input.actorUserId },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "session_document",
        action: "opened",
        entityId: row.id,
        payload: { bookingId: booking.id },
      })
    }
  )

  const path = sessionDocumentDownloadPath(booking.id, row.id, token)
  return {
    url: `${input.apiBase.replace(/\/$/, "")}${path}`,
    expiresAt: expiresAt.toISOString(),
  }
}

export async function loadSessionDocumentForDownload(input: {
  bookingId: string
  documentId: string
  actorUserId: string
}): Promise<{
  blobUrl: string
  mime: string
  originalName: string
  orgId: string
}> {
  const booking = await loadBooking(input.bookingId)
  if (!booking) throw new SessionDocumentError("NOT_FOUND")
  const role = actorRole(booking, input.actorUserId)
  const [row] = await withOrgAndUserContext(
    booking.orgId,
    input.actorUserId,
    (tx) =>
      tx
        .select()
        .from(sessionDocuments)
        .where(
          and(
            eq(sessionDocuments.id, input.documentId),
            eq(sessionDocuments.orgId, booking.orgId),
            eq(sessionDocuments.bookingId, booking.id),
            isNull(sessionDocuments.deletedAt)
          )
        )
        .limit(1)
  )
  if (!row) throw new SessionDocumentError("NOT_FOUND")
  if (role === "member" && row.scope !== "shared") {
    throw new SessionDocumentError("FORBIDDEN")
  }
  return {
    blobUrl: row.blobUrl,
    mime: row.mime,
    originalName: await decryptMetadata(booking.orgId, row),
    orgId: booking.orgId,
  }
}

export async function deleteSessionDocument(input: {
  bookingId: string
  documentId: string
  actorUserId: string
}): Promise<{ blobUrl: string }> {
  const booking = await loadBooking(input.bookingId)
  if (!booking) throw new SessionDocumentError("NOT_FOUND")
  if (input.actorUserId !== booking.expertUserId) {
    throw new SessionDocumentError("FORBIDDEN")
  }
  const [row] = await withOrgAndUserContext(
    booking.orgId,
    input.actorUserId,
    (tx) =>
      tx
        .select()
        .from(sessionDocuments)
        .where(
          and(
            eq(sessionDocuments.id, input.documentId),
            eq(sessionDocuments.orgId, booking.orgId),
            eq(sessionDocuments.bookingId, booking.id),
            isNull(sessionDocuments.deletedAt)
          )
        )
        .limit(1)
  )
  if (!row) throw new SessionDocumentError("NOT_FOUND")
  if (row.uploadedBy !== input.actorUserId) {
    throw new SessionDocumentError("FORBIDDEN")
  }
  return { blobUrl: row.blobUrl }
}

export async function markSessionDocumentDeleted(input: {
  bookingId: string
  documentId: string
  actorUserId: string
}): Promise<void> {
  const booking = await loadBooking(input.bookingId)
  if (!booking) throw new SessionDocumentError("NOT_FOUND")
  if (input.actorUserId !== booking.expertUserId) {
    throw new SessionDocumentError("FORBIDDEN")
  }
  await withAudit(
    { orgId: booking.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const updated = (
        await tx
          .update(sessionDocuments)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(sessionDocuments.id, input.documentId),
              eq(sessionDocuments.orgId, booking.orgId),
              eq(sessionDocuments.uploadedBy, input.actorUserId),
              isNull(sessionDocuments.deletedAt)
            )
          )
          .returning({ id: sessionDocuments.id })
      )[0]
      if (!updated) throw new SessionDocumentError("NOT_FOUND")
      await ctx.emit({
        entity: "session_document",
        action: "deleted",
        entityId: input.documentId,
        payload: { bookingId: booking.id },
      })
    }
  )
}
