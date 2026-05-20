import { getSignInUrl } from "@workos-inc/authkit-nextjs"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { sanitizeReturnTo } from "@eleva/auth/return-to"
import { resolveLocaleFromHeaders } from "@eleva/config/i18n"

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
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"))
  const hdrs = await headers()
  const locale = resolveLocaleFromHeaders({
    cookie: hdrs.get("cookie"),
    acceptLanguage: hdrs.get("accept-language"),
    country: hdrs.get("x-vercel-ip-country"),
  })
  const url = await getSignInUrl({
    returnTo,
    state: JSON.stringify({ locale }),
  })
  redirect(url)
}
