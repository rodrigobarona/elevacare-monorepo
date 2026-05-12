import { handleAuth } from "@workos-inc/authkit-nextjs"
import { cookies } from "next/headers"
import { cookieName, isLocale } from "@eleva/config/i18n"

/**
 * WorkOS OAuth callback. AuthKit exchanges the authorization code for
 * a session cookie, then redirects to the auth-redirect page which
 * decides routing based on onboarding status.
 *
 * On success, syncs the user's WorkOS locale preference to the
 * ELEVA_LOCALE cookie so language follows the user across devices.
 *
 * No provisioning here -- org creation happens in the onboarding wizard,
 * and data sync happens via the QStash-driven Events API poller.
 */
export const GET = handleAuth({
  returnPathname: "/auth-redirect",
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  onSuccess: async (data) => {
    const userLocale = data.user.locale
    if (userLocale) {
      const shortLocale = userLocale.split("-")[0]!.toLowerCase()
      if (isLocale(shortLocale)) {
        const jar = await cookies()
        jar.set(cookieName, shortLocale, {
          path: "/",
          maxAge: 31536000,
          sameSite: "lax",
        })
      }
    }
  },
})
