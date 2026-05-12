import { handleAuth } from "@workos-inc/authkit-nextjs"
import { provisionNewUser } from "@/lib/provision-user"

/**
 * WorkOS OAuth callback. AuthKit exchanges the authorization code for
 * a session cookie, provisions the user's personal org on first sign-in,
 * then redirects to the role-home page via the gateway.
 */
export const GET = handleAuth({
  returnPathname: "/auth-redirect",
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  onSuccess: async ({ user, organizationId }) => {
    await provisionNewUser(user, organizationId)
  },
})
