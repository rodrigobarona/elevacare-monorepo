import { handleAuth } from "@workos-inc/authkit-nextjs"

/**
 * WorkOS OAuth callback. AuthKit exchanges the authorization code for
 * a session cookie then redirects to the returnPathname. We route the
 * user to `/` which picks the role-home redirect in page.tsx.
 */
export const GET = handleAuth({
  returnPathname: "/",
})
