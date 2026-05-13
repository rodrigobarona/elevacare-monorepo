import { handleAuth } from "@workos-inc/authkit-nextjs"
import { cookies } from "next/headers"
import { cookieName, isLocale } from "@eleva/config/i18n"

/**
 * WorkOS OAuth callback. AuthKit exchanges the authorization code for
 * a session cookie, then redirects to the auth-redirect page which
 * decides routing based on onboarding status.
 *
 * Locale strategy:
 *   - If an ELEVA_LOCALE cookie already exists (user picked a language
 *     on the marketing site before signing in), keep it — the user's
 *     explicit choice takes priority over the WorkOS profile locale.
 *   - Only fall back to the WorkOS user locale when no valid cookie is
 *     present (e.g. direct navigation to /signin without visiting the
 *     marketing site first).
 *
 * No provisioning here -- org creation happens in the onboarding wizard,
 * and data sync happens via the QStash-driven Events API poller.
 */
export const GET = handleAuth({
  returnPathname: "/auth-redirect",
  baseURL: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL,
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
