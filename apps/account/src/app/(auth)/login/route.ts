import { getSignInUrl } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

/**
 * Always run dynamically -- this route sets a PKCE cookie via
 * iron-session sealing and must never be prerendered or cached.
 *
 * Runtime is Node.js because `getSignInUrl()` is a server action
 * that uses `@workos-inc/node` under the hood (not edge-compatible
 * in @workos-inc/authkit-nextjs v4).
 */
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const returnTo = searchParams.get("returnTo") ?? undefined
  const url = await getSignInUrl({ returnTo })
  redirect(url)
}
