import { and, asc, eq, isNull } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import {
  withOrgAndUserContext,
  withPlatformAdminContext,
  type Tx,
} from "@eleva/db"
import { user } from "@eleva/db/schema/auth"
import {
  bookings,
  expertProfiles,
  recordTemplates,
  type RecordTemplateKind,
  type RecordTemplateRow,
} from "@eleva/db/schema"
import { listSessionRecords, requireAssignedExpert } from "./session-records"
import {
  scanTemplateForPhi,
  fillTemplatePlaceholders,
  tokenizeTemplatePlaceholders,
  type TemplatePhiFinding,
  type TemplatePlaceholderValues,
} from "./template-phi-scan"

export type RecordTemplateErrorCode = "NOT_FOUND" | "FORBIDDEN" | "PHI_DETECTED"

export type TemplatePhiFieldFinding = TemplatePhiFinding & {
  field: "title" | "body"
}

export class RecordTemplateError extends Error {
  override readonly name = "RecordTemplateError"

  constructor(
    readonly code: RecordTemplateErrorCode,
    readonly findings: readonly TemplatePhiFieldFinding[] = [],
    /** The exact text the findings' offsets refer to (trimmed and tokenised). */
    readonly scanned?: { title: string; body: string }
  ) {
    super(code)
  }
}

export type RecordTemplateView = {
  id: string
  kind: RecordTemplateKind
  locale: string
  title: string
  body: string
  tags: string[]
  isDefault: boolean
  version: number
  archivedAt: string | null
  updatedAt: string
}

function toView(row: RecordTemplateRow): RecordTemplateView {
  return {
    id: row.id,
    kind: row.kind,
    locale: row.locale,
    title: row.title,
    body: row.body,
    tags: row.tags,
    isDefault: row.isDefault,
    version: row.version,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

type BookingContext = {
  values: TemplatePlaceholderValues
  names: string[]
  identifiers: string[]
  sourceTexts: string[]
}

function sessionDateLabel(startsAt: Date, timezone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: timezone,
  }).format(startsAt)
}

function dateIdentifiers(startsAt: Date, timezone: string): string[] {
  const out = new Set<string>()
  for (const locale of ["en", "pt", "es"]) {
    for (const dateStyle of ["long", "medium", "short"] as const) {
      out.add(
        new Intl.DateTimeFormat(locale, {
          dateStyle,
          timeZone: timezone,
        }).format(startsAt)
      )
    }
    out.add(
      new Intl.DateTimeFormat(locale, {
        timeStyle: "short",
        timeZone: timezone,
      }).format(startsAt)
    )
  }
  return [...out]
}

/**
 * Placeholder values and member identifiers for one booking. Caller must
 * already be the assigned expert (requireAssignedExpert).
 */
async function loadBookingContext(input: {
  orgId: string
  bookingId: string
  actorUserId: string
  locale: string
  includeSourceTexts: boolean
}): Promise<BookingContext> {
  const booking = await requireAssignedExpert({
    bookingId: input.bookingId,
    actorUserId: input.actorUserId,
  })
  if (booking.orgId !== input.orgId) throw new RecordTemplateError("FORBIDDEN")

  const [row] = await withPlatformAdminContext((tx) =>
    tx
      .select({
        guestName: bookings.guestName,
        guestEmail: bookings.guestEmail,
        guestPhone: bookings.guestPhone,
        startsAt: bookings.startsAt,
        timezone: bookings.timezone,
        memberName: user.name,
        memberEmail: user.email,
        memberPhone: user.phoneE164,
        expertName: expertProfiles.displayName,
      })
      .from(bookings)
      .leftJoin(user, eq(user.id, bookings.memberUserId))
      .leftJoin(expertProfiles, eq(expertProfiles.id, bookings.expertProfileId))
      .where(eq(bookings.id, input.bookingId))
      .limit(1)
  )
  if (!row) throw new RecordTemplateError("NOT_FOUND")

  const memberName = (row.guestName ?? row.memberName ?? "").trim()
  const firstName = memberName.split(/\s+/)[0] ?? ""
  const values: TemplatePlaceholderValues = {
    "member.firstName": firstName || undefined,
    "session.date": sessionDateLabel(row.startsAt, row.timezone, input.locale),
    "expert.name": row.expertName ?? undefined,
  }
  const names = [memberName, row.memberName ?? ""].filter(Boolean)
  const identifiers = [
    row.guestEmail ?? "",
    row.memberEmail ?? "",
    row.guestPhone ?? "",
    row.memberPhone ?? "",
    ...dateIdentifiers(row.startsAt, row.timezone),
  ].filter(Boolean)

  const sourceTexts = input.includeSourceTexts
    ? (
        await listSessionRecords({
          bookingId: input.bookingId,
          actorUserId: input.actorUserId,
        })
      ).map((record) => record.body)
    : []

  return { values, names, identifiers, sourceTexts }
}

function assertNoPhi(
  fields: { title: string; body: string },
  context?: Pick<BookingContext, "names" | "identifiers" | "sourceTexts">
) {
  const findings: TemplatePhiFieldFinding[] = [
    ...scanTemplateForPhi(fields.title, context).map((f) => ({
      ...f,
      field: "title" as const,
    })),
    ...scanTemplateForPhi(fields.body, context).map((f) => ({
      ...f,
      field: "body" as const,
    })),
  ]
  if (findings.length > 0) {
    throw new RecordTemplateError("PHI_DETECTED", findings, fields)
  }
}

async function clearDefault(
  tx: Tx,
  orgId: string,
  kind: RecordTemplateKind,
  locale: string
) {
  await tx
    .update(recordTemplates)
    .set({ isDefault: false })
    .where(
      and(
        eq(recordTemplates.orgId, orgId),
        eq(recordTemplates.kind, kind),
        eq(recordTemplates.locale, locale),
        eq(recordTemplates.isDefault, true)
      )
    )
}

export async function listRecordTemplates(input: {
  orgId: string
  actorUserId: string
  kind?: RecordTemplateKind
  includeArchived?: boolean
}): Promise<RecordTemplateView[]> {
  const filters = [eq(recordTemplates.orgId, input.orgId)]
  if (input.kind) filters.push(eq(recordTemplates.kind, input.kind))
  if (!input.includeArchived) filters.push(isNull(recordTemplates.archivedAt))
  const rows = await withOrgAndUserContext(
    input.orgId,
    input.actorUserId,
    (tx) =>
      tx
        .select()
        .from(recordTemplates)
        .where(and(...filters))
        .orderBy(asc(recordTemplates.kind), asc(recordTemplates.title))
  )
  return rows.map(toView)
}

export async function createRecordTemplate(input: {
  orgId: string
  actorUserId: string
  kind: RecordTemplateKind
  locale: string
  title: string
  body: string
  tags?: string[]
  isDefault?: boolean
  /** "Save as template" from a booking's record: tokenise, then scrub against that member. */
  sourceBookingId?: string
}): Promise<RecordTemplateView> {
  let title = input.title.trim()
  let body = input.body
  if (input.sourceBookingId) {
    const context = await loadBookingContext({
      orgId: input.orgId,
      bookingId: input.sourceBookingId,
      actorUserId: input.actorUserId,
      locale: input.locale,
      includeSourceTexts: true,
    })
    title = tokenizeTemplatePlaceholders(title, context.values)
    body = tokenizeTemplatePlaceholders(body, context.values)
    assertNoPhi({ title, body }, context)
  } else {
    assertNoPhi({ title, body })
  }

  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      if (input.isDefault) {
        await clearDefault(tx, input.orgId, input.kind, input.locale)
      }
      const [row] = await tx
        .insert(recordTemplates)
        .values({
          orgId: input.orgId,
          kind: input.kind,
          locale: input.locale,
          title,
          body,
          tags: input.tags ?? [],
          isDefault: input.isDefault ?? false,
          createdBy: input.actorUserId,
        })
        .returning()
      if (!row) throw new RecordTemplateError("NOT_FOUND")
      await ctx.emit({
        entity: "record_template",
        action: "created",
        entityId: row.id,
        payload: {
          kind: row.kind,
          locale: row.locale,
          fromRecord: Boolean(input.sourceBookingId),
        },
      })
      return toView(row)
    }
  )
}

export async function updateRecordTemplate(input: {
  orgId: string
  actorUserId: string
  id: string
  title?: string
  body?: string
  tags?: string[]
  isDefault?: boolean
}): Promise<RecordTemplateView> {
  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [existing] = await tx
        .select()
        .from(recordTemplates)
        .where(
          and(
            eq(recordTemplates.orgId, input.orgId),
            eq(recordTemplates.id, input.id),
            isNull(recordTemplates.archivedAt)
          )
        )
        .limit(1)
      if (!existing) throw new RecordTemplateError("NOT_FOUND")
      const title = input.title?.trim() ?? existing.title
      const body = input.body ?? existing.body
      assertNoPhi({ title, body })
      if (input.isDefault) {
        await clearDefault(tx, input.orgId, existing.kind, existing.locale)
      }
      const [row] = await tx
        .update(recordTemplates)
        .set({
          title,
          body,
          tags: input.tags ?? existing.tags,
          isDefault: input.isDefault ?? existing.isDefault,
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(recordTemplates.id, existing.id))
        .returning()
      if (!row) throw new RecordTemplateError("NOT_FOUND")
      await ctx.emit({
        entity: "record_template",
        action: "updated",
        entityId: row.id,
        payload: { kind: row.kind, version: row.version },
      })
      return toView(row)
    }
  )
}

export async function archiveRecordTemplate(input: {
  orgId: string
  actorUserId: string
  id: string
}): Promise<void> {
  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [row] = await tx
        .update(recordTemplates)
        .set({
          archivedAt: new Date(),
          isDefault: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(recordTemplates.orgId, input.orgId),
            eq(recordTemplates.id, input.id),
            isNull(recordTemplates.archivedAt)
          )
        )
        .returning({ id: recordTemplates.id, kind: recordTemplates.kind })
      if (!row) throw new RecordTemplateError("NOT_FOUND")
      await ctx.emit({
        entity: "record_template",
        action: "archived",
        entityId: row.id,
        payload: { kind: row.kind },
      })
    }
  )
}

/** Fill a template for one booking. Returns text for the editor; nothing is stored. */
export async function applyRecordTemplate(input: {
  orgId: string
  actorUserId: string
  id: string
  bookingId: string
}): Promise<{ title: string; body: string }> {
  const [template] = await withOrgAndUserContext(
    input.orgId,
    input.actorUserId,
    (tx) =>
      tx
        .select()
        .from(recordTemplates)
        .where(
          and(
            eq(recordTemplates.orgId, input.orgId),
            eq(recordTemplates.id, input.id),
            isNull(recordTemplates.archivedAt)
          )
        )
        .limit(1)
  )
  if (!template) throw new RecordTemplateError("NOT_FOUND")
  const context = await loadBookingContext({
    orgId: input.orgId,
    bookingId: input.bookingId,
    actorUserId: input.actorUserId,
    locale: template.locale,
    includeSourceTexts: false,
  })
  return {
    title: fillTemplatePlaceholders(template.title, context.values),
    body: fillTemplatePlaceholders(template.body, context.values),
  }
}
