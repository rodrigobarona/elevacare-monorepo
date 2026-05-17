import { handleAuth } from "@workos-inc/authkit-nextjs"
import { cookies } from "next/headers"
import { cookieName, isLocale } from "@eleva/config/i18n"

/**
 * Always dynamic -- this route exchanges the OAuth code for a session,
 * sets the WorkOS session cookie, and may set the locale cookie.
 * Never prerender, never cache.
 */
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

/**
 * WorkOS OAuth callback for the account app. Sets the session cookie
 * on `.eleva.care` so all apps can read it, then redirects to
 * /dashboard which handles post-login routing.
 */
export const GET = handleAuth({
  returnPathname: "/dashboard",
  baseURL: process.env.ACCOUNT_URL || process.env.NEXT_PUBLIC_ACCOUNT_URL,
  onSuccess: async (data) => {
    const jar = await cookies()
    const existing = jar.get(cookieName)?.value

    if (existing && isLocale(existing)) {
      return
    }

    const userLocale = data.user.locale
    if (userLocale) {
      const shortLocale = userLocale.split("-")[0]!.toLowerCase()
      if (isLocale(shortLocale)) {
        jar.set(cookieName, shortLocale, {
          path: "/",
          maxAge: 31536000,
          sameSite: "lax",
        })
      }
    }
  },
})
