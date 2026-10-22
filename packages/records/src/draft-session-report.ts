import { randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import {
  AiModelNotApprovedError,
  AiModelZeroRetentionRequiredError,
  generateSessionReportDraft,
} from "@eleva/ai"
import { withAudit } from "@eleva/audit"
import {
  hasActiveAiProcessingConsent,
  withPlatformAdminContext,
} from "@eleva/db"
import { records } from "@eleva/db/schema"
import { decryptRecordFields, encryptRecordFields } from "@eleva/encryption"
import { registerPhi } from "@eleva/observability"
import { recordLogger } from "./record-logger"
import { SessionRecordError, SESSION_RECORD_TITLES } from "./errors"
import {
  listSessionRecords,
  requireAssignedExpert,
  type SessionRecordView,
} from "./session-records"

export type DraftSessionReportInput = {
  bookingId: string
  actorUserId: string
  noteRecordIds: string[]
}

export type DraftSessionReportStatus = {
  bookingId: string
  aiDraft: SessionRecordView | null
  lastFailedAt: string | null
}

type NoteRow = {
  id: string
  kind: string
  orgId: string
  bookingId: string | null
  createdBy: string
  titleEncrypted: string
  bodyEncrypted: string
}

async function loadNoteRows(noteRecordIds: string[]): Promise<NoteRow[]> {
  if (noteRecordIds.length === 0) return []
  return withPlatformAdminContext((tx) =>
    tx
      .select({
        id: records.id,
        kind: records.kind,
        orgId: records.orgId,
        bookingId: records.bookingId,
        createdBy: records.createdBy,
        titleEncrypted: records.titleEncrypted,
        bodyEncrypted: records.bodyEncrypted,
      })
      .from(records)
      .where(inArray(records.id, noteRecordIds))
  )
}

function mapModelError(err: unknown): SessionRecordError | null {
  if (err instanceof AiModelNotApprovedError) {
    return new SessionRecordError("AI_MODEL_NOT_APPROVED")
  }
  if (err instanceof AiModelZeroRetentionRequiredError) {
    return new SessionRecordError("AI_MODEL_ZERO_RETENTION_REQUIRED")
  }
  return null
}

export async function getSessionReportDraftStatus(input: {
  bookingId: string
  actorUserId: string
}): Promise<DraftSessionReportStatus> {
  const booking = await requireAssignedExpert(input)
  const listed = await listSessionRecords({
    bookingId: booking.id,
    actorUserId: input.actorUserId,
  })
  const aiDraft = listed.find((row) => row.kind === "ai_draft") ?? null
  return {
    bookingId: booking.id,
    aiDraft,
    lastFailedAt: null,
  }
}

export async function draftSessionReport(
  input: DraftSessionReportInput
): Promise<SessionRecordView> {
  const booking = await requireAssignedExpert(input)
  const uniqueIds = [...new Set(input.noteRecordIds)]
  if (uniqueIds.length === 0) {
    throw new SessionRecordError("FORBIDDEN")
  }

  const consentGranted = await hasActiveAiProcessingConsent({
    memberUserId: booking.memberUserId,
    bookingId: booking.id,
  })
  if (!consentGranted) {
    throw new SessionRecordError("AI_CONSENT_REQUIRED")
  }

  const rows = await loadNoteRows(uniqueIds)
  if (rows.length !== uniqueIds.length) {
    throw new SessionRecordError("FORBIDDEN")
  }

  for (const row of rows) {
    if (row.kind !== "note") throw new SessionRecordError("FORBIDDEN")
    if (row.bookingId !== booking.id) throw new SessionRecordError("FORBIDDEN")
    if (row.orgId !== booking.orgId) throw new SessionRecordError("FORBIDDEN")
    if (row.createdBy !== input.actorUserId) {
      throw new SessionRecordError("FORBIDDEN")
    }
  }

  const noteTexts: string[] = []
  for (const row of rows) {
    const plain = (
      await decryptRecordFields(
        booking.orgId,
        { title: row.titleEncrypted, body: row.bodyEncrypted },
        { recordId: row.id }
      )
    ).reveal()
    const text = plain.body?.trim()
    if (text) {
      registerPhi(text)
      noteTexts.push(text)
    }
  }

  if (noteTexts.length === 0) {
    throw new SessionRecordError("FORBIDDEN")
  }

  const intake = (
    await listSessionRecords({
      bookingId: booking.id,
      actorUserId: input.actorUserId,
    })
  ).find((row) => row.kind === "intake")

  let generation
  try {
    generation = await generateSessionReportDraft({
      locale: "en",
      noteTexts,
      intakeText: intake?.body,
    })
  } catch (err) {
    const mapped = mapModelError(err)
    if (mapped) {
      await withAudit(
        { orgId: booking.orgId, actorUserId: input.actorUserId },
        async (_tx, ctx) => {
          await ctx.emit({
            entity: "ai_draft",
            action: "failed",
            entityId: booking.id,
            payload: { bookingId: booking.id, reason: mapped.code },
          })
        }
      )
      throw mapped
    }
    throw err
  }

  registerPhi(generation.body)

  recordLogger.info("ai_draft.generated", {
    bookingId: booking.id,
    orgId: booking.orgId,
    modelId: generation.modelId,
    tokenCount:
      (generation.usage?.promptTokens ?? 0) +
      (generation.usage?.completionTokens ?? 0),
    durationMs: 0,
    status: "ok",
  })

  return withAudit(
    { orgId: booking.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      await ctx.emit({
        entity: "ai_draft",
        action: "requested",
        entityId: booking.id,
        payload: { bookingId: booking.id, noteRecordIds: uniqueIds },
      })

      const title = SESSION_RECORD_TITLES.ai_draft

      const existing = await tx
        .select({ id: records.id, version: records.version })
        .from(records)
        .where(
          and(
            eq(records.orgId, booking.orgId),
            eq(records.bookingId, booking.id),
            eq(records.kind, "ai_draft")
          )
        )
        .limit(1)

      let recordId: string
      if (existing[0]) {
        recordId = existing[0].id
        const sealed = await encryptRecordFields(
          booking.orgId,
          { title, body: generation.body },
          { recordId }
        )
        if (sealed.title == null || sealed.body == null) {
          throw new Error("ai draft encryption failed")
        }
        await tx
          .update(records)
          .set({
            titleEncrypted: sealed.title,
            bodyEncrypted: sealed.body,
            version: existing[0].version + 1,
            updatedAt: new Date(),
            createdBy: input.actorUserId,
          })
          .where(eq(records.id, recordId))
      } else {
        recordId = randomUUID()
        const sealed = await encryptRecordFields(
          booking.orgId,
          { title, body: generation.body },
          { recordId }
        )
        if (sealed.title == null || sealed.body == null) {
          throw new Error("ai draft encryption failed")
        }
        await tx.insert(records).values({
          id: recordId,
          orgId: booking.orgId,
          memberUserId: booking.memberUserId,
          bookingId: booking.id,
          kind: "ai_draft",
          titleEncrypted: sealed.title,
          bodyEncrypted: sealed.body,
          createdBy: input.actorUserId,
        })
      }

      await ctx.emit({
        entity: "ai_draft",
        action: "generated",
        entityId: recordId,
        payload: {
          bookingId: booking.id,
          modelId: generation.modelId,
          promptVersion: generation.promptVersion,
        },
      })

      const [stored] = await tx
        .select()
        .from(records)
        .where(eq(records.id, recordId))
        .limit(1)
      if (!stored) throw new SessionRecordError("NOT_FOUND")

      const plain = (
        await decryptRecordFields(
          booking.orgId,
          { title: stored.titleEncrypted, body: stored.bodyEncrypted },
          { recordId: stored.id }
        )
      ).reveal()

      return {
        id: stored.id,
        kind: "ai_draft" as const,
        title: plain.title ?? title,
        body: plain.body ?? "",
        version: stored.version,
        updatedAt: stored.updatedAt.toISOString(),
        publishedAt: stored.publishedAt?.toISOString() ?? null,
      }
    }
  )
}
