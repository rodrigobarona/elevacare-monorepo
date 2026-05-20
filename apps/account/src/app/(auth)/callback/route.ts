import { handleAuth } from "@workos-inc/authkit-nextjs"
import { cookies, headers } from "next/headers"
import { getWorkOS } from "@eleva/auth/server"
import {
  cookieName,
  getLocaleCookieOptions,
  normalizeLocale,
  normalizeWorkOSLocale,
  type Locale,
} from "@eleva/config/i18n"

/**
 * Always dynamic -- this route exchanges the OAuth code for a session,
 * sets the WorkOS session cookie, and may set the locale cookie.
 * Never prerender, never cache.
 */
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

function parseStateLocale(state: unknown): Locale | null {
  if (typeof state !== "string" || !state) return null

  try {
    const parsed = JSON.parse(state) as { locale?: unknown }
    return normalizeLocale(parsed.locale)
  } catch {
    return null
  }
}

async function getRequestHost(): Promise<string | null> {
  const hdrs = await headers()
  return hdrs.get("x-forwarded-host") ?? hdrs.get("host")
}

/**
 * WorkOS OAuth callback for the account app. Sets the session cookie
 * on `.eleva.care` so all apps can read it, then redirects to
 * /dashboard which handles post-login routing.
 */
export const GET = handleAuth({
  returnPathname: "/dashboard",
  baseURL: process.env.ACCOUNT_URL || process.env.NEXT_PUBLIC_ACCOUNT_URL,
  onSuccess: async (data) => {
    const [jar, host] = await Promise.all([cookies(), getRequestHost()])
    const existingLocale = normalizeLocale(jar.get(cookieName)?.value)
    const stateLocale = parseStateLocale(data.state)
    const workosLocale = normalizeWorkOSLocale(data.user.locale)

    if (workosLocale) {
      jar.set(cookieName, workosLocale, getLocaleCookieOptions(host))
      return
    }

    const preAuthLocale = stateLocale ?? existingLocale
    if (preAuthLocale) {
      jar.set(cookieName, preAuthLocale, getLocaleCookieOptions(host))
      await getWorkOS().userManagement.updateUser({
        userId: data.user.id,
        locale: preAuthLocale,
      })
    }
  },
})
