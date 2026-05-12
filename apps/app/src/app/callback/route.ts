import { handleAuth } from "@workos-inc/authkit-nextjs"

/**
 * WorkOS OAuth callback. AuthKit exchanges the authorization code for
 * a session cookie, then redirects to the auth-redirect page which
 * decides routing based on onboarding status.
 *
 * No provisioning here -- org creation happens in the onboarding wizard,
 * and data sync happens via the QStash-driven Events API poller.
 */
export const GET = handleAuth({
  returnPathname: "/auth-redirect",
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
})
