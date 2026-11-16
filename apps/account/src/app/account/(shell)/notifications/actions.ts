"use server"

import { revalidatePath } from "next/cache"
import { unstable_rethrow } from "next/navigation"
import { PutNotificationPreferencesRequestSchema } from "@eleva/api-client"
import { getPersonalApiClient } from "@/lib/personal-api"

/** Saves the channel switches; quiet hours and time zone are left as they are. */
export async function updateNotificationPreferences(
  input: unknown
): Promise<{ ok: boolean }> {
  const parsed = PutNotificationPreferencesRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  try {
    const api = await getPersonalApiClient()
    await api.me.putNotificationPreferences({
      preferences: parsed.data.preferences,
    })
    revalidatePath("/account/notifications")
    return { ok: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("updateNotificationPreferences failed", err)
    return { ok: false }
  }
}
