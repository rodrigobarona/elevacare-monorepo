import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { withOrgAndUserContext } from "@eleva/db"
import { user } from "@eleva/db/schema/auth"
import {
  crmContacts,
  crmFollowUps,
  type CrmFollowUpKind,
  type CrmFollowUpRow,
} from "@eleva/db/schema"
import { decryptRecordFields, encryptRecordFields } from "@eleva/encryption"
import { assertContactVisible, requireCrmExpert } from "./access"
import { CrmError } from "./errors"

const FOLLOW_UP_LIST_LIMIT = 500

export type CrmFollowUpStatus = "open" | "done" | "all"

export type CrmFollowUp = {
  id: string
  contactId: string
  contactName: string | null
  memberUserId: string | null
  dueAt: string
  kind: CrmFollowUpKind
  note: string | null
  doneAt: string | null
}

async function decryptNote(row: CrmFollowUpRow): Promise<string | null> {
  if (!row.noteEncrypted) return null
  const plain = (
    await decryptRecordFields(
      row.orgId,
      { note: row.noteEncrypted },
      { recordId: row.id }
    )
  ).reveal()
  return plain.note ?? null
}

async function toFollowUp(
  row: CrmFollowUpRow,
  contact: { name: string | null; memberUserId: string | null }
): Promise<CrmFollowUp> {
  return {
    id: row.id,
    contactId: row.contactId,
    contactName: contact.name,
    memberUserId: contact.memberUserId,
    dueAt: row.dueAt.toISOString(),
    kind: row.kind,
    note: await decryptNote(row),
    doneAt: row.doneAt?.toISOString() ?? null,
  }
}

/** The actor's own follow-ups, soonest due first (newest done first). */
export async function listCrmFollowUps(input: {
  orgId: string
  actorUserId: string
  status?: CrmFollowUpStatus
  contactId?: string
}): Promise<CrmFollowUp[]> {
  await requireCrmExpert(input.orgId, input.actorUserId)
  const status = input.status ?? "open"
  const filters = [
    eq(crmFollowUps.orgId, input.orgId),
    eq(crmFollowUps.createdBy, input.actorUserId),
  ]
  if (input.contactId) filters.push(eq(crmFollowUps.contactId, input.contactId))
  switch (status) {
    case "open":
      filters.push(isNull(crmFollowUps.doneAt))
      break
    case "done":
      filters.push(isNotNull(crmFollowUps.doneAt))
      break
    case "all":
      break
    default: {
      const exhaustive: never = status
      throw new Error(`Unhandled follow-up status: ${String(exhaustive)}`)
    }
  }
  const rows = await withOrgAndUserContext(
    input.orgId,
    input.actorUserId,
    (tx) =>
      tx
        .select({
          followUp: crmFollowUps,
          memberUserId: crmContacts.memberUserId,
          name: sql<string | null>`coalesce(${crmContacts.name}, ${user.name})`,
        })
        .from(crmFollowUps)
        .innerJoin(crmContacts, eq(crmContacts.id, crmFollowUps.contactId))
        .leftJoin(user, eq(user.id, crmContacts.memberUserId))
        .where(and(...filters))
        .orderBy(
          status === "done"
            ? desc(crmFollowUps.doneAt)
            : asc(crmFollowUps.dueAt)
        )
        .limit(FOLLOW_UP_LIST_LIMIT)
  )
  return Promise.all(
    rows.map((row) =>
      toFollowUp(row.followUp, {
        name: row.name,
        memberUserId: row.memberUserId,
      })
    )
  )
}

export async function createCrmFollowUp(input: {
  orgId: string
  actorUserId: string
  contactId: string
  dueAt: Date
  kind: CrmFollowUpKind
  note?: string | null
}): Promise<CrmFollowUp> {
  const expertProfileId = await requireCrmExpert(input.orgId, input.actorUserId)
  const [contact] = await withOrgAndUserContext(
    input.orgId,
    input.actorUserId,
    (tx) =>
      tx
        .select()
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.orgId, input.orgId),
            eq(crmContacts.id, input.contactId)
          )
        )
        .limit(1)
  )
  if (!contact) throw new CrmError("NOT_FOUND")
  const memberName = await assertContactVisible(
    contact,
    expertProfileId,
    input.actorUserId
  )

  const id = crypto.randomUUID()
  const note = input.note?.trim()
  const noteEncrypted = note
    ? ((await encryptRecordFields(input.orgId, { note }, { recordId: id }))
        .note ?? null)
    : null

  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [row] = await tx
        .insert(crmFollowUps)
        .values({
          id,
          orgId: input.orgId,
          contactId: contact.id,
          dueAt: input.dueAt,
          kind: input.kind,
          noteEncrypted,
          createdBy: input.actorUserId,
        })
        .returning()
      if (!row) throw new CrmError("NOT_FOUND")
      await ctx.emit({
        entity: "crm_follow_up",
        action: "created",
        entityId: row.id,
        payload: { contactId: contact.id, kind: row.kind },
      })
      return toFollowUp(row, {
        name: contact.memberUserId ? memberName : contact.name,
        memberUserId: contact.memberUserId,
      })
    }
  )
}

/** Marks the actor's follow-up done. Completing it again is a no-op. */
export async function completeCrmFollowUp(input: {
  orgId: string
  actorUserId: string
  followUpId: string
}): Promise<CrmFollowUp> {
  await requireCrmExpert(input.orgId, input.actorUserId)
  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [current] = await tx
        .select({
          followUp: crmFollowUps,
          memberUserId: crmContacts.memberUserId,
          name: sql<string | null>`coalesce(${crmContacts.name}, ${user.name})`,
        })
        .from(crmFollowUps)
        .innerJoin(crmContacts, eq(crmContacts.id, crmFollowUps.contactId))
        .leftJoin(user, eq(user.id, crmContacts.memberUserId))
        .where(
          and(
            eq(crmFollowUps.orgId, input.orgId),
            eq(crmFollowUps.id, input.followUpId),
            eq(crmFollowUps.createdBy, input.actorUserId)
          )
        )
        .limit(1)
        .for("update", { of: crmFollowUps })
      if (!current) throw new CrmError("NOT_FOUND")
      const contact = { name: current.name, memberUserId: current.memberUserId }
      if (current.followUp.doneAt) {
        await ctx.emit({
          entity: "crm_follow_up",
          action: "status_changed",
          entityId: current.followUp.id,
          payload: { status: "done", alreadyDone: true },
        })
        return toFollowUp(current.followUp, contact)
      }
      const [row] = await tx
        .update(crmFollowUps)
        .set({ doneAt: new Date(), updatedAt: new Date() })
        .where(eq(crmFollowUps.id, current.followUp.id))
        .returning()
      if (!row) throw new CrmError("NOT_FOUND")
      await ctx.emit({
        entity: "crm_follow_up",
        action: "status_changed",
        entityId: row.id,
        payload: { status: "done" },
      })
      return toFollowUp(row, contact)
    }
  )
}
