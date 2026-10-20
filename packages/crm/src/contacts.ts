import { and, eq, inArray, isNull, or, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import {
  listExpertMembers,
  withOrgAndUserContext,
  type ExpertMemberListItem,
} from "@eleva/db"
import {
  crmContacts,
  crmFollowUps,
  type CrmContactRow,
  type CrmLifecycleStage,
} from "@eleva/db/schema"
import { decryptRecordFields, encryptRecordFields } from "@eleva/encryption"
import { assertContactVisible, requireCrmExpert } from "./access"
import { CrmError } from "./errors"

/** A member with bookings but no CRM row yet is treated as active. */
export const DEFAULT_MEMBER_STAGE: CrmLifecycleStage = "active"

export type CrmContactSource = "member" | "guest" | "lead"

export type CrmContactListItem = {
  /** Null until the expert first sets a stage, tag or follow-up. */
  id: string | null
  source: CrmContactSource
  memberUserId: string | null
  name: string | null
  email: string | null
  phone: string | null
  lifecycleStage: CrmLifecycleStage
  tags: string[]
  sessionCount: number
  lastSessionAt: string | null
  nextSessionAt: string | null
  openFollowUps: number
}

export type CrmContact = {
  id: string
  source: "member" | "lead"
  memberUserId: string | null
  name: string | null
  email: string | null
  phone: string | null
  lifecycleStage: CrmLifecycleStage
  tags: string[]
  updatedAt: string
}

type LeadFields = { email: string | null; phone: string | null }

async function decryptLeadFields(row: CrmContactRow): Promise<LeadFields> {
  const sealed: Record<string, string> = {}
  if (row.emailEncrypted) sealed.email = row.emailEncrypted
  if (row.phoneEncrypted) sealed.phone = row.phoneEncrypted
  if (Object.keys(sealed).length === 0) return { email: null, phone: null }
  const plain = (
    await decryptRecordFields(row.orgId, sealed, { recordId: row.id })
  ).reveal()
  return { email: plain.email ?? null, phone: plain.phone ?? null }
}

async function sealLeadFields(
  orgId: string,
  contactId: string,
  fields: { email?: string | null; phone?: string | null }
): Promise<{ emailEncrypted?: string | null; phoneEncrypted?: string | null }> {
  const plain: Record<string, string> = {}
  if (fields.email) plain.email = fields.email
  if (fields.phone) plain.phone = fields.phone
  const sealed = Object.keys(plain).length
    ? await encryptRecordFields(orgId, plain, { recordId: contactId })
    : {}
  const out: {
    emailEncrypted?: string | null
    phoneEncrypted?: string | null
  } = {}
  if (fields.email !== undefined) out.emailEncrypted = sealed.email ?? null
  if (fields.phone !== undefined) out.phoneEncrypted = sealed.phone ?? null
  return out
}

async function toContact(
  row: CrmContactRow,
  memberName: string | null = null
): Promise<CrmContact> {
  const lead = row.memberUserId ? null : await decryptLeadFields(row)
  return {
    id: row.id,
    source: row.memberUserId ? "member" : "lead",
    memberUserId: row.memberUserId,
    name: row.memberUserId ? memberName : row.name,
    email: lead?.email ?? null,
    phone: lead?.phone ?? null,
    lifecycleStage: row.lifecycleStage,
    tags: row.tags,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Members (from bookings) overlaid with their CRM rows, then the actor's
 * manual leads. Member identity and session stats always come from
 * bookings; the CRM row only adds stage and tags.
 */
export function mergeContactList(input: {
  members: readonly ExpertMemberListItem[]
  memberRows: readonly CrmContactRow[]
  leads: readonly (CrmContactRow & LeadFields)[]
  openFollowUps: ReadonlyMap<string, number>
}): CrmContactListItem[] {
  const byMember = new Map(
    input.memberRows.map((row) => [row.memberUserId, row])
  )
  const leads = input.leads.map(
    (row): CrmContactListItem => ({
      id: row.id,
      source: "lead",
      memberUserId: null,
      name: row.name,
      email: row.email,
      phone: row.phone,
      lifecycleStage: row.lifecycleStage,
      tags: row.tags,
      sessionCount: 0,
      lastSessionAt: null,
      nextSessionAt: null,
      openFollowUps: input.openFollowUps.get(row.id) ?? 0,
    })
  )
  const members = input.members.map((member): CrmContactListItem => {
    const row = member.memberUserId
      ? byMember.get(member.memberUserId)
      : undefined
    return {
      id: row?.id ?? null,
      source: member.memberUserId ? "member" : "guest",
      memberUserId: member.memberUserId,
      name: member.name,
      email: member.email,
      phone: null,
      lifecycleStage: row?.lifecycleStage ?? DEFAULT_MEMBER_STAGE,
      tags: row?.tags ?? [],
      sessionCount: member.sessionCount,
      lastSessionAt: member.lastSessionAt?.toISOString() ?? null,
      nextSessionAt: member.nextSessionAt?.toISOString() ?? null,
      openFollowUps: row ? (input.openFollowUps.get(row.id) ?? 0) : 0,
    }
  })
  return [...leads, ...members]
}

export async function listCrmContacts(input: {
  orgId: string
  actorUserId: string
  stage?: CrmLifecycleStage
}): Promise<CrmContactListItem[]> {
  const expertProfileId = await requireCrmExpert(input.orgId, input.actorUserId)
  const members = await listExpertMembers(input.orgId, expertProfileId)
  const memberIds = members.flatMap((m) =>
    m.memberUserId ? [m.memberUserId] : []
  )
  const { rows, counts } = await withOrgAndUserContext(
    input.orgId,
    input.actorUserId,
    async (tx) => {
      const ownLead = and(
        isNull(crmContacts.memberUserId),
        eq(crmContacts.createdBy, input.actorUserId)
      )
      const rows = await tx
        .select()
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.orgId, input.orgId),
            memberIds.length
              ? or(inArray(crmContacts.memberUserId, memberIds), ownLead)
              : ownLead
          )
        )
        .orderBy(sql`${crmContacts.createdAt} desc`)
      const counts = await tx
        .select({
          contactId: crmFollowUps.contactId,
          open: sql<number>`count(*)::int`,
        })
        .from(crmFollowUps)
        .where(
          and(
            eq(crmFollowUps.orgId, input.orgId),
            eq(crmFollowUps.createdBy, input.actorUserId),
            isNull(crmFollowUps.doneAt)
          )
        )
        .groupBy(crmFollowUps.contactId)
      return { rows, counts }
    }
  )
  const leadRows = rows.filter((row) => !row.memberUserId)
  const leads = await Promise.all(
    leadRows.map(async (row) => ({ ...row, ...(await decryptLeadFields(row)) }))
  )
  const list = mergeContactList({
    members,
    memberRows: rows.filter((row) => row.memberUserId),
    leads,
    openFollowUps: new Map(counts.map((c) => [c.contactId, Number(c.open)])),
  })
  return input.stage
    ? list.filter((item) => item.lifecycleStage === input.stage)
    : list
}

type ContactPatch = {
  lifecycleStage?: CrmLifecycleStage
  tags?: string[]
}

export type CreateCrmContactInput = {
  orgId: string
  actorUserId: string
} & ContactPatch &
  (
    | { memberUserId: string }
    | { name: string; email?: string | null; phone?: string | null }
  )

/**
 * Manual lead, or the CRM row for a member who booked this expert. A
 * second call for the same member updates stage/tags instead.
 */
export async function createCrmContact(
  input: CreateCrmContactInput
): Promise<CrmContact> {
  const expertProfileId = await requireCrmExpert(input.orgId, input.actorUserId)
  if ("memberUserId" in input) {
    return upsertMemberContact({ ...input, expertProfileId })
  }

  const id = crypto.randomUUID()
  const sealed = await sealLeadFields(input.orgId, id, input)
  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [row] = await tx
        .insert(crmContacts)
        .values({
          id,
          orgId: input.orgId,
          name: input.name.trim(),
          ...sealed,
          lifecycleStage: input.lifecycleStage ?? "lead",
          tags: input.tags ?? [],
          createdBy: input.actorUserId,
        })
        .returning()
      if (!row) throw new CrmError("NOT_FOUND")
      await ctx.emit({
        entity: "crm_contact",
        action: "created",
        entityId: row.id,
        payload: { source: "lead", lifecycleStage: row.lifecycleStage },
      })
      return toContact(row)
    }
  )
}

async function upsertMemberContact(
  input: {
    orgId: string
    actorUserId: string
    memberUserId: string
    expertProfileId: string
  } & ContactPatch
): Promise<CrmContact> {
  const member = await assertContactVisible(
    {
      orgId: input.orgId,
      memberUserId: input.memberUserId,
      createdBy: null,
    },
    input.expertProfileId,
    input.actorUserId
  ).catch((err: unknown) => {
    if (err instanceof CrmError) throw new CrmError("MEMBER_NOT_FOUND")
    throw err
  })
  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [existing] = await tx
        .select({ id: crmContacts.id })
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.orgId, input.orgId),
            eq(crmContacts.memberUserId, input.memberUserId)
          )
        )
        .limit(1)
      const patch = {
        ...(input.lifecycleStage
          ? { lifecycleStage: input.lifecycleStage }
          : {}),
        ...(input.tags ? { tags: input.tags } : {}),
      }
      const [row] = await tx
        .insert(crmContacts)
        .values({
          orgId: input.orgId,
          memberUserId: input.memberUserId,
          lifecycleStage: input.lifecycleStage ?? DEFAULT_MEMBER_STAGE,
          tags: input.tags ?? [],
          createdBy: input.actorUserId,
        })
        .onConflictDoUpdate({
          target: [crmContacts.orgId, crmContacts.memberUserId],
          targetWhere: sql`member_user_id IS NOT NULL`,
          set: { ...patch, updatedAt: new Date() },
        })
        .returning()
      if (!row) throw new CrmError("NOT_FOUND")
      await ctx.emit({
        entity: "crm_contact",
        action: existing ? "updated" : "created",
        entityId: row.id,
        payload: {
          source: "member",
          fields: Object.keys(patch),
          lifecycleStage: row.lifecycleStage,
        },
      })
      return toContact(row, member)
    }
  )
}

export async function updateCrmContact(
  input: {
    orgId: string
    actorUserId: string
    contactId: string
    name?: string
    email?: string | null
    phone?: string | null
  } & ContactPatch
): Promise<CrmContact> {
  const expertProfileId = await requireCrmExpert(input.orgId, input.actorUserId)
  const [current] = await withOrgAndUserContext(
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
  if (!current) throw new CrmError("NOT_FOUND")
  const memberName = await assertContactVisible(
    current,
    expertProfileId,
    input.actorUserId
  )

  const editsIdentity =
    input.name !== undefined ||
    input.email !== undefined ||
    input.phone !== undefined
  if (current.memberUserId && editsIdentity) throw new CrmError("NOT_A_LEAD")

  const sealed = await sealLeadFields(input.orgId, current.id, input)
  const patch = {
    ...(input.lifecycleStage ? { lifecycleStage: input.lifecycleStage } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...sealed,
  }
  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [row] = await tx
        .update(crmContacts)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(crmContacts.orgId, input.orgId),
            eq(crmContacts.id, current.id)
          )
        )
        .returning()
      if (!row) throw new CrmError("NOT_FOUND")
      const stageChanged =
        input.lifecycleStage !== undefined &&
        input.lifecycleStage !== current.lifecycleStage
      await ctx.emit({
        entity: "crm_contact",
        action: stageChanged ? "status_changed" : "updated",
        entityId: row.id,
        payload: {
          fields: Object.keys(patch).map((key) =>
            key.replace(/Encrypted$/, "")
          ),
          lifecycleStage: row.lifecycleStage,
          ...(stageChanged ? { from: current.lifecycleStage } : {}),
        },
      })
      return toContact(row, memberName)
    }
  )
}
