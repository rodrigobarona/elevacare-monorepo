"use server"

import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { unstable_rethrow } from "next/navigation"
import { z } from "zod"
import {
  isIanaTimeZone,
  PatchMeRequestSchema,
  UpdateAvatarRequestSchema,
  UpdateUserLocaleRequestSchema,
} from "@eleva/api-client"
import { requireSession } from "@eleva/auth/server"
import { mintUploadToken } from "@eleva/auth/upload-token"
import { isAvatarUrl } from "@eleva/config/avatar-upload"
import { cookieName, getLocaleCookieOptions } from "@eleva/config/i18n"
import { deletePublicObject } from "@eleva/storage"
import { getPersonalApiClient } from "@/lib/personal-api"

type Result = { ok: true } | { ok: false }

const PROFILE_PATH = "/account/settings"

// ── Your details ────────────────────────────────────────────────────

export async function updateDetails(input: unknown): Promise<Result> {
  const parsed = PatchMeRequestSchema.safeParse(input)
  if (!parsed.success || !parsed.data.name) return { ok: false }
  try {
    const api = await getPersonalApiClient()
    await api.me.patch({ name: parsed.data.name })
    revalidatePath(PROFILE_PATH)
    return { ok: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("updateDetails failed", err)
    return { ok: false }
  }
}

// ── Language and time zone ──────────────────────────────────────────

const RegionSchema = z.object({
  locale: UpdateUserLocaleRequestSchema.shape.locale,
  timezone: z.string().min(1).max(64).refine(isIanaTimeZone),
})

export async function updateRegion(input: unknown): Promise<Result> {
  const parsed = RegionSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  const { locale, timezone } = parsed.data
  try {
    // Save on the user (emails read it), then the cookie (the interface).
    const api = await getPersonalApiClient()
    await Promise.all([
      api.users.locale.update({ locale }),
      api.me.patch({ timezone }),
    ])
    const [jar, hdrs] = await Promise.all([cookies(), headers()])
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host")
    jar.set(
      cookieName,
      locale,
      getLocaleCookieOptions(host, { httpOnly: false })
    )
    revalidatePath("/", "layout")
    return { ok: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("updateRegion failed", err)
    return { ok: false }
  }
}

// ── Photo ───────────────────────────────────────────────────────────

export async function getAvatarUploadToken(): Promise<string> {
  const session = await requireSession()
  return mintUploadToken(session.user.id)
}

/**
 * An uploaded photo that could not be saved is deleted, not left behind.
 * A failed save may still have committed (the response was lost), so the
 * profile is read first: the object is deleted only when the profile holds
 * a different photo, and kept when that read fails. A leftover upload is
 * safer than a deleted profile photo.
 */
async function discardOrphanAvatar(url: string): Promise<void> {
  try {
    const session = await requireSession()
    if (!isAvatarUrl(url, session.user.id)) return
    const api = await getPersonalApiClient()
    const profile = await api.me.get()
    if (profile.avatarUrl !== url) await deletePublicObject(url)
  } catch (err) {
    unstable_rethrow(err)
    console.warn("discardOrphanAvatar failed", err)
  }
}

export async function updateAvatar(url: unknown): Promise<Result> {
  const parsed = UpdateAvatarRequestSchema.safeParse({ url })
  if (!parsed.success) return { ok: false }
  // Only a photo the API never accepted is deleted: once the save has
  // gone through, a later failure must not remove the person's photo.
  let saved = false
  try {
    const api = await getPersonalApiClient()
    await api.users.avatar.update(parsed.data)
    saved = true
    revalidatePath(PROFILE_PATH)
    return { ok: true }
  } catch (err) {
    unstable_rethrow(err)
    if (!saved) await discardOrphanAvatar(parsed.data.url)
    console.error("updateAvatar failed", err)
    return { ok: saved }
  }
}

export async function removeAvatar(): Promise<Result> {
  try {
    const api = await getPersonalApiClient()
    await api.users.avatar.remove()
    revalidatePath(PROFILE_PATH)
    return { ok: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("removeAvatar failed", err)
    return { ok: false }
  }
}
