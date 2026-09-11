import { withAudit } from "@eleva/audit"
import {
  getMemberProfile,
  listMemberNotificationPreferences,
  updateMemberProfileRow,
  upsertMemberNotificationPreferencesInTx,
  type MemberNotificationPreference,
  type MemberProfile,
} from "@eleva/db"

export async function updateMemberProfile(input: {
  userId: string
  orgId: string
  name?: string
  timezone?: string | null
  locale?: string | null
  avatarUrl?: string | null
}): Promise<MemberProfile | null> {
  const fields: string[] = []
  if (input.name !== undefined) fields.push("name")
  if (input.timezone !== undefined) fields.push("timezone")
  if (input.locale !== undefined) fields.push("locale")
  if (input.avatarUrl !== undefined) fields.push("avatarUrl")

  return withAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const row = await updateMemberProfileRow(tx, {
        userId: input.userId,
        actorUserId: input.userId,
        name: input.name,
        timezone: input.timezone,
        locale: input.locale,
        avatarUrl: input.avatarUrl,
      })
      await ctx.emit({
        entity: "user",
        action: "updated",
        entityId: input.userId,
        payload: { fields },
      })
      return row
    }
  )
}

export async function updateMemberNotificationPreferences(input: {
  userId: string
  orgId: string
  timezone?: string | null
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  preferences: Array<{
    channel: MemberNotificationPreference["channel"]
    category: MemberNotificationPreference["category"]
    enabled: boolean
  }>
}): Promise<MemberNotificationPreference[]> {
  return withAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const rows = await upsertMemberNotificationPreferencesInTx(tx, {
        userId: input.userId,
        timezone: input.timezone,
        quietHoursStart: input.quietHoursStart,
        quietHoursEnd: input.quietHoursEnd,
        preferences: input.preferences,
      })
      await ctx.emit({
        entity: "user",
        action: "updated",
        entityId: input.userId,
        payload: {
          field: "notification_preferences",
          count: input.preferences.length,
        },
      })
      return rows
    }
  )
}

export { getMemberProfile, listMemberNotificationPreferences }
export type { MemberNotificationPreference, MemberProfile }
