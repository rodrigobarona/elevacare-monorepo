"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import {
  getWidgetTokenFromSession,
  requireSession,
  getWorkOS,
} from "@eleva/auth/server"
import { mintUploadToken } from "@eleva/auth/upload-token"
import { getUserAvatarUrl, updateUserAvatarUrl } from "@eleva/db"
import { isLocale, cookieName, type Locale } from "@eleva/config/i18n"

export async function getSettingsWidgetToken(): Promise<string> {
  return getWidgetTokenFromSession(["widgets:users-table:manage"])
}

// ── Language preference ─────────────────────────────────────────────

type LanguageState = { ok: true; saved?: boolean } | { ok: false }

export async function updateLanguagePreference(
  _prev: LanguageState,
  formData: FormData
): Promise<LanguageState> {
  const raw = formData.get("locale")
  if (typeof raw !== "string" || !isLocale(raw)) {
    return { ok: false }
  }
  const locale: Locale = raw

  try {
    const session = await requireSession()

    const workos = getWorkOS()
    await workos.userManagement.updateUser({
      userId: session.user.workosUserId,
      locale,
    })

    const jar = await cookies()
    jar.set(cookieName, locale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: false,
    })

    revalidatePath("/", "layout")
    return { ok: true, saved: true }
  } catch (err) {
    console.error("updateLanguagePreference failed", err)
    return { ok: false }
  }
}

// ── Avatar ──────────────────────────────────────────────────────────

export async function getAvatarUploadToken(): Promise<string> {
  const session = await requireSession()
  return mintUploadToken(session.user.id)
}

export async function getCurrentAvatarUrl(): Promise<string | null> {
  const session = await requireSession()
  return getUserAvatarUrl(session.user.id)
}

export async function updateAvatar(url: string): Promise<{ ok: boolean }> {
  try {
    const session = await requireSession()
    await updateUserAvatarUrl(session.user.id, url)
    revalidatePath("/settings")
    return { ok: true }
  } catch (err) {
    console.error("updateAvatar failed", err)
    return { ok: false }
  }
}

export async function removeAvatar(): Promise<{ ok: boolean }> {
  try {
    const session = await requireSession()
    await updateUserAvatarUrl(session.user.id, null)
    revalidatePath("/settings")
    return { ok: true }
  } catch (err) {
    console.error("removeAvatar failed", err)
    return { ok: false }
  }
}
