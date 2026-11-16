import { withAudit } from "@eleva/audit"
import { updateMemberProfileRow } from "@eleva/db"
import type { Locale } from "@eleva/config/i18n"

/**
 * Save a person's language on their user row, whatever workspace they are
 * in (member Space, expert practice, clinic). Emails read `user.locale`;
 * the `ELEVA_LOCALE` cookie stays the UI's source, set by the caller.
 */
export async function updateUserLocale(input: {
  userId: string
  orgId: string
  locale: Locale
}): Promise<void> {
  await withAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      await updateMemberProfileRow(tx, {
        userId: input.userId,
        actorUserId: input.userId,
        locale: input.locale,
      })
      await ctx.emit({
        entity: "user",
        action: "updated",
        entityId: input.userId,
        payload: { fields: ["locale"] },
      })
    }
  )
}
