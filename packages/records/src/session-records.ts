import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { withAudit, type AuditCtx } from "@eleva/audit"
import {
  hasActiveAiProcessingConsent,
  withOrgAndUserContext,
  withOrgContext,
  withPlatformAdminContext,
  withUserContext,
  type Tx,
} from "@eleva/db"
import {
  bookings,
  expertProfiles,
  records,
  slotReservations,
} from "@eleva/db/schema"
import { decryptRecordFields, encryptRecordFields } from "@eleva/encryption"
import { decryptHoldIntake } from "./hold-intake"
import { recordLogger } from "./record-logger"
import {
  isWritableSessionRecordKind,
  PUBLISHABLE_SESSION_RECORD_KIND,
  SESSION_RECORD_TITLES,
  SessionRecordError,
  type SessionRecordKind,
  type WritableSessionRecordKind,
} from "./errors"

export type SessionRecordView = {
  id: string
  kind: SessionRecordKind
  title: string
  body: string
  version: number
  updatedAt: string
  publishedAt: string | null
}

type BookingRow = {
  id: string
  orgId: string
  expertUserId: string
  memberUserId: string | null
}

function isSessionKind(kind: string): kind is SessionRecordKind {
  return kind in SESSION_RECORD_TITLES
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

async function decryptRow(
  orgId: string,
  row: typeof records.$inferSelect
): Promise<SessionRecordView | null> {
  if (!isSessionKind(row.kind)) return null
  const plain = (
    await decryptRecordFields(
      orgId,
      { title: row.titleEncrypted, body: row.bodyEncrypted },
      { recordId: row.id }
    )
  ).reveal()
  return {
    id: row.id,
    kind: row.kind,
    title: plain.title ?? SESSION_RECORD_TITLES[row.kind],
    body: plain.body ?? "",
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  }
}

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err
  for (let i = 0; i < 4; i++) {
    if (!current || typeof current !== "object") return false
    if ("code" in current && (current as { code: unknown }).code === "23505") {
      return true
    }
    current = "cause" in current ? (current as { cause: unknown }).cause : null
  }
  return false
}

function encryptionFailed(): never {
  throw new Error("session record encryption failed")
}

async function listDecrypted(
  tx: Tx,
  booking: BookingRow,
  options?: { publishedOnly?: boolean }
): Promise<SessionRecordView[]> {
  const filters = [
    eq(records.orgId, booking.orgId),
    eq(records.bookingId, booking.id),
  ]
  if (options?.publishedOnly) {
    filters.push(isNotNull(records.publishedAt))
    filters.push(eq(records.kind, PUBLISHABLE_SESSION_RECORD_KIND))
  }
  const rows = await tx
    .select()
    .from(records)
    .where(and(...filters))
  const views: SessionRecordView[] = []
  for (const row of rows) {
    const view = await decryptRow(booking.orgId, row)
    if (view) views.push(view)
  }
  return [...views].sort((a, b) => a.kind.localeCompare(b.kind))
}

async function persistKind(
  tx: Tx,
  ctx: AuditCtx,
  input: {
    booking: BookingRow
    actorUserId: string
    kind: SessionRecordKind
    body: string
    title?: string
  }
): Promise<SessionRecordView> {
  const title = input.title ?? SESSION_RECORD_TITLES[input.kind]
  const existing = (
    await tx
      .select()
      .from(records)
      .where(
        and(
          eq(records.orgId, input.booking.orgId),
          eq(records.bookingId, input.booking.id),
          eq(records.kind, input.kind)
        )
      )
      .limit(1)
  )[0]

  if (existing) {
    const sealed = await encryptRecordFields(
      input.booking.orgId,
      { title, body: input.body },
      { recordId: existing.id }
    )
    const titleEncrypted = sealed.title
    const bodyEncrypted = sealed.body
    if (titleEncrypted == null || bodyEncrypted == null) {
      encryptionFailed()
    }
    const updated = (
      await tx
        .update(records)
        .set({
          titleEncrypted,
          bodyEncrypted,
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(records.id, existing.id),
            eq(records.createdBy, input.actorUserId)
          )
        )
        .returning()
    )[0]
    if (!updated) throw new SessionRecordError("NOT_FOUND")
    await ctx.emit({
      entity: "record",
      action: "updated",
      entityId: existing.id,
      payload: { kind: input.kind, bookingId: input.booking.id },
    })
    const view = await decryptRow(input.booking.orgId, updated)
    if (!view) throw new SessionRecordError("NOT_FOUND")
    return view
  }

  const id = crypto.randomUUID()
  const sealed = await encryptRecordFields(
    input.booking.orgId,
    { title, body: input.body },
    { recordId: id }
  )
  const titleEncrypted = sealed.title
  const bodyEncrypted = sealed.body
  if (titleEncrypted == null || bodyEncrypted == null) {
    encryptionFailed()
  }
  let inserted
  try {
    inserted = (
      await tx
        .insert(records)
        .values({
          id,
          orgId: input.booking.orgId,
          memberUserId: input.booking.memberUserId,
          bookingId: input.booking.id,
          kind: input.kind,
          titleEncrypted,
          bodyEncrypted,
          createdBy: input.actorUserId,
        })
        .returning()
    )[0]
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const raced = (
      await tx
        .select()
        .from(records)
        .where(
          and(
            eq(records.orgId, input.booking.orgId),
            eq(records.bookingId, input.booking.id),
            eq(records.kind, input.kind)
          )
        )
        .limit(1)
    )[0]
    if (!raced) throw err
    const retrySealed = await encryptRecordFields(
      input.booking.orgId,
      { title, body: input.body },
      { recordId: raced.id }
    )
    const retryTitle = retrySealed.title
    const retryBody = retrySealed.body
    if (retryTitle == null || retryBody == null) {
      encryptionFailed()
    }
    const updated = (
      await tx
        .update(records)
        .set({
          titleEncrypted: retryTitle,
          bodyEncrypted: retryBody,
          version: raced.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(records.id, raced.id),
            eq(records.createdBy, input.actorUserId)
          )
        )
        .returning()
    )[0]
    if (!updated) throw new SessionRecordError("NOT_FOUND")
    await ctx.emit({
      entity: "record",
      action: "updated",
      entityId: raced.id,
      payload: { kind: input.kind, bookingId: input.booking.id },
    })
    const racedView = await decryptRow(input.booking.orgId, updated)
    if (!racedView) throw new SessionRecordError("NOT_FOUND")
    return racedView
  }
  if (!inserted) throw new SessionRecordError("NOT_FOUND")
  await ctx.emit({
    entity: "record",
    action: "created",
    entityId: id,
    payload: { kind: input.kind, bookingId: input.booking.id },
  })
  const view = await decryptRow(input.booking.orgId, inserted)
  if (!view) throw new SessionRecordError("NOT_FOUND")
  return view
}

async function hydrateIntake(
  booking: BookingRow,
  actorUserId: string,
  existing: SessionRecordView[],
  options?: { relist?: boolean }
): Promise<SessionRecordView[]> {
  if (existing.some((row) => row.kind === "intake")) return existing
  const [reservation] = await withPlatformAdminContext((tx) =>
    tx
      .select({
        id: slotReservations.id,
        funnel: slotReservations.funnel,
      })
      .from(slotReservations)
      .where(eq(slotReservations.bookingId, booking.id))
      .limit(1)
  )
  if (!reservation) return existing
  const encrypted = reservation.funnel?.intakeNotesEncrypted
  let notes = ""
  try {
    notes = encrypted
      ? (await decryptHoldIntake(booking.orgId, encrypted, reservation.id))
          .reveal()
          .trim()
      : (reservation.funnel?.intakeNotes?.trim() ?? "")
  } catch {
    recordLogger.error("intake decrypt failed", {
      bookingId: booking.id,
      status: "decrypt_failed",
    })
    return existing
  }
  if (!notes) return existing
  await withAudit({ orgId: booking.orgId, actorUserId }, async (tx, ctx) => {
    await persistKind(tx, ctx, {
      booking,
      actorUserId,
      kind: "intake",
      body: notes,
    })
    await tx
      .update(slotReservations)
      .set({
        funnel: sql`"funnel" - 'intakeNotes' - 'intakeNotesEncrypted'`,
      })
      .where(eq(slotReservations.bookingId, booking.id))
  })
  if (options?.relist === false) return existing
  return withOrgAndUserContext(booking.orgId, actorUserId, (tx) =>
    listDecrypted(tx, booking)
  )
}

export async function persistBookingIntake(bookingId: string): Promise<void> {
  const booking = await loadBooking(bookingId)
  if (!booking) return
  await hydrateIntake(booking, booking.expertUserId, [], { relist: false })
}

export async function requireAssignedExpert(input: {
  bookingId: string
  actorUserId: string
}): Promise<BookingRow> {
  const booking = await loadBooking(input.bookingId)
  if (!booking) throw new SessionRecordError("NOT_FOUND")
  if (input.actorUserId !== booking.expertUserId) {
    throw new SessionRecordError("FORBIDDEN")
  }
  return booking
}

export async function listSessionRecords(input: {
  bookingId: string
  actorUserId: string
}): Promise<SessionRecordView[]> {
  const booking = await loadBooking(input.bookingId)
  if (!booking) throw new SessionRecordError("NOT_FOUND")

  if (input.actorUserId === booking.expertUserId) {
    const listed = await withOrgAndUserContext(
      booking.orgId,
      input.actorUserId,
      (tx) => listDecrypted(tx, booking)
    )
    return hydrateIntake(booking, input.actorUserId, listed)
  }

  if (booking.memberUserId && input.actorUserId === booking.memberUserId) {
    const listed = await withOrgAndUserContext(
      booking.orgId,
      input.actorUserId,
      (tx) => listDecrypted(tx, booking, { publishedOnly: true })
    )
    return listed.filter((row) => row.kind === PUBLISHABLE_SESSION_RECORD_KIND)
  }

  throw new SessionRecordError("FORBIDDEN")
}

export async function upsertSessionRecord(input: {
  bookingId: string
  actorUserId: string
  kind: string
  body: string
}): Promise<SessionRecordView> {
  if (input.kind === "intake") {
    throw new SessionRecordError("INTAKE_READONLY")
  }
  if (!isWritableSessionRecordKind(input.kind)) {
    throw new SessionRecordError("NOT_FOUND")
  }
  const kind: WritableSessionRecordKind = input.kind
  const booking = await loadBooking(input.bookingId)
  if (!booking) throw new SessionRecordError("NOT_FOUND")
  if (input.actorUserId !== booking.expertUserId) {
    throw new SessionRecordError("FORBIDDEN")
  }
  if (
    kind === "transcript" &&
    !(await hasActiveAiProcessingConsent({
      memberUserId: booking.memberUserId,
      bookingId: booking.id,
    }))
  ) {
    throw new SessionRecordError("AI_CONSENT_REQUIRED")
  }
  // withAudit(actorUserId) uses withOrgAndUserContext, which sets
  // eleva.user_id for records_author_insert / records_author_update WITH CHECK.
  return withAudit(
    { orgId: booking.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) =>
      persistKind(tx, ctx, {
        booking,
        actorUserId: input.actorUserId,
        kind,
        body: input.body,
      })
  )
}

export async function setSessionRecordPublished(input: {
  bookingId: string
  recordId: string
  actorUserId: string
  published: boolean
}): Promise<SessionRecordView> {
  const booking = await requireAssignedExpert(input)
  if (!booking.memberUserId) throw new SessionRecordError("NOT_PUBLISHABLE")
  return withAudit(
    { orgId: booking.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [existing] = await tx
        .select({ kind: records.kind, publishedAt: records.publishedAt })
        .from(records)
        .where(
          and(
            eq(records.id, input.recordId),
            eq(records.orgId, booking.orgId),
            eq(records.bookingId, booking.id),
            eq(records.createdBy, input.actorUserId)
          )
        )
        .limit(1)
      if (!existing) throw new SessionRecordError("NOT_FOUND")
      if (existing.kind !== PUBLISHABLE_SESSION_RECORD_KIND) {
        throw new SessionRecordError("NOT_PUBLISHABLE")
      }
      const [updated] = await tx
        .update(records)
        .set({
          publishedAt: input.published
            ? (existing.publishedAt ?? new Date())
            : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(records.id, input.recordId),
            eq(records.createdBy, input.actorUserId)
          )
        )
        .returning()
      if (!updated) throw new SessionRecordError("NOT_FOUND")
      await ctx.emit({
        entity: "record",
        action: input.published ? "published" : "unpublished",
        entityId: updated.id,
        payload: { kind: updated.kind, bookingId: booking.id },
      })
      const view = await decryptRow(booking.orgId, updated)
      if (!view) throw new SessionRecordError("NOT_FOUND")
      return view
    }
  )
}

export type MemberReportView = SessionRecordView & {
  bookingId: string
  sessionStartsAt: string
  expertDisplayName: string
}

/** Published session reports across every booking of this member. */
export async function listMemberReports(input: {
  memberUserId: string
}): Promise<MemberReportView[]> {
  const rows = await withUserContext(input.memberUserId, (tx) =>
    tx
      .select()
      .from(records)
      .where(
        and(
          eq(records.memberUserId, input.memberUserId),
          eq(records.kind, PUBLISHABLE_SESSION_RECORD_KIND),
          isNotNull(records.publishedAt),
          isNotNull(records.bookingId)
        )
      )
      .orderBy(desc(records.publishedAt))
  )
  if (rows.length === 0) return []

  const bookingIdsByOrg = new Map<string, string[]>()
  for (const row of rows) {
    const ids = bookingIdsByOrg.get(row.orgId) ?? []
    ids.push(row.bookingId!)
    bookingIdsByOrg.set(row.orgId, ids)
  }
  const sessions = new Map<
    string,
    { startsAt: Date; displayName: string; memberUserId: string | null }
  >()
  await Promise.all(
    [...bookingIdsByOrg.entries()].map(async ([orgId, ids]) => {
      const found = await withOrgContext(orgId, (tx) =>
        tx
          .select({
            id: bookings.id,
            startsAt: bookings.startsAt,
            memberUserId: bookings.memberUserId,
            displayName: expertProfiles.displayName,
          })
          .from(bookings)
          .innerJoin(
            expertProfiles,
            eq(expertProfiles.id, bookings.expertProfileId)
          )
          .where(inArray(bookings.id, ids))
      )
      for (const row of found) sessions.set(row.id, row)
    })
  )

  const reports: MemberReportView[] = []
  for (const row of rows) {
    const session = sessions.get(row.bookingId!)
    if (!session || session.memberUserId !== input.memberUserId) continue
    const view = await decryptRow(row.orgId, row)
    if (!view) continue
    reports.push({
      ...view,
      bookingId: row.bookingId!,
      sessionStartsAt: session.startsAt.toISOString(),
      expertDisplayName: session.displayName,
    })
  }
  return reports
}
