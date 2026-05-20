"use server"

import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import {
  getWidgetTokenFromSession,
  requireSession,
  getWorkOS,
} from "@eleva/auth/server"
import { mintUploadToken } from "@eleva/auth/upload-token"
import { createApiClient } from "@eleva/api-client"
import {
  isLocale,
  cookieName,
  getLocaleCookieOptions,
  type Locale,
} from "@eleva/config/i18n"

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL environment variable is required but not set"
    )
  }
  return url
}

async function getAuthedApiClient() {
  const session = await requireSession()
  const token = await mintUploadToken(session.user.id)
  return createApiClient({ baseUrl: getApiBaseUrl(), bearerToken: token })
}

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

    const [jar, hdrs] = await Promise.all([cookies(), headers()])
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host")
    jar.set(
      cookieName,
      locale,
      getLocaleCookieOptions(host, { httpOnly: false })
    )

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
  const api = await getAuthedApiClient()
  const { avatarUrl } = await api.users.avatar.get()
  return avatarUrl
}

export async function updateAvatar(url: string): Promise<{ ok: boolean }> {
  try {
    const api = await getAuthedApiClient()
    await api.users.avatar.update({ url })
    revalidatePath("/profile")
    return { ok: true }
  } catch (err) {
    console.error("updateAvatar failed", err)
    return { ok: false }
  }
}

export async function removeAvatar(): Promise<{ ok: boolean }> {
  try {
    const api = await getAuthedApiClient()
    await api.users.avatar.remove()
    revalidatePath("/profile")
    return { ok: true }
  } catch (err) {
    console.error("removeAvatar failed", err)
    return { ok: false }
  }
}
