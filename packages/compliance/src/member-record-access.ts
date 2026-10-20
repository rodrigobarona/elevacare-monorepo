import { and, eq, inArray, sql } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { auth, main, withPlatformAdminContext } from "@eleva/db"

export type MemberRecordAccessChoice = {
  orgId: string
  orgName: string
  clinicSharedRecords: boolean
  optedOut: boolean
}

export class MemberRecordAccessForbiddenError extends Error {
  readonly code = "RECORD_ACCESS_ORG_NOT_ELIGIBLE"

  constructor() {
    super("You can only opt out for clinics where you have booked a session")
    this.name = "MemberRecordAccessForbiddenError"
  }
}

async function eligibleClinicOrgIds(
  userId: string,
  orgId?: string
): Promise<Set<string>> {
  const rows = await withPlatformAdminContext((tx) =>
    tx
      .selectDistinct({ orgId: auth.organization.id })
      .from(main.bookings)
      .innerJoin(
        main.expertProfiles,
        eq(main.bookings.expertProfileId, main.expertProfiles.id)
      )
      .innerJoin(
        auth.organization,
        eq(main.expertProfiles.orgId, auth.organization.id)
      )
      .where(
        and(
          eq(main.bookings.memberUserId, userId),
          eq(auth.organization.type, "team"),
          orgId ? eq(auth.organization.id, orgId) : sql`true`
        )
      )
  )
  return new Set(rows.map((row) => row.orgId))
}

export async function listMemberRecordAccessChoices(
  userId: string
): Promise<MemberRecordAccessChoice[]> {
  const eligible = await eligibleClinicOrgIds(userId)
  if (eligible.size === 0) {
    return []
  }

  const orgIds = [...eligible]

  const [clinics, optouts] = await Promise.all([
    withPlatformAdminContext((tx) =>
      tx
        .select({
          orgId: auth.organization.id,
          orgName: auth.organization.name,
          clinicSharedRecords: auth.organization.clinicSharedRecords,
        })
        .from(auth.organization)
        .where(inArray(auth.organization.id, orgIds))
    ),
    withPlatformAdminContext((tx) =>
      tx
        .select({ orgId: main.recordAccessOptouts.orgId })
        .from(main.recordAccessOptouts)
        .where(eq(main.recordAccessOptouts.memberUserId, userId))
    ),
  ])

  const optedOut = new Set(
    optouts.map((row) => row.orgId).filter((id): id is string => id != null)
  )

  return [...clinics]
    .map((clinic) => ({
      orgId: clinic.orgId,
      orgName: clinic.orgName,
      clinicSharedRecords: clinic.clinicSharedRecords,
      optedOut: optedOut.has(clinic.orgId),
    }))
    .sort((a, b) => a.orgName.localeCompare(b.orgName))
}

export async function setMemberRecordAccessOptout(input: {
  userId: string
  orgId: string
  optedOut: boolean
}): Promise<MemberRecordAccessChoice[]> {
  const eligible = await eligibleClinicOrgIds(input.userId, input.orgId)
  if (!eligible.has(input.orgId)) {
    throw new MemberRecordAccessForbiddenError()
  }

  await withPlatformAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const existing = await tx
        .select({ orgId: main.recordAccessOptouts.orgId })
        .from(main.recordAccessOptouts)
        .where(
          and(
            eq(main.recordAccessOptouts.memberUserId, input.userId),
            eq(main.recordAccessOptouts.orgId, input.orgId)
          )
        )
        .limit(1)

      if (input.optedOut) {
        if (existing.length === 0) {
          await tx.insert(main.recordAccessOptouts).values({
            memberUserId: input.userId,
            orgId: input.orgId,
          })
          await ctx.emit({
            entity: "record_access_optout",
            action: "created",
            entityId: `${input.userId}:${input.orgId}`,
            payload: { orgId: input.orgId },
          })
        }
        return
      }

      if (existing.length > 0) {
        await tx
          .delete(main.recordAccessOptouts)
          .where(
            and(
              eq(main.recordAccessOptouts.memberUserId, input.userId),
              eq(main.recordAccessOptouts.orgId, input.orgId)
            )
          )
        await ctx.emit({
          entity: "record_access_optout",
          action: "deleted",
          entityId: `${input.userId}:${input.orgId}`,
          payload: { orgId: input.orgId },
        })
      }
    }
  )

  return listMemberRecordAccessChoices(input.userId)
}
