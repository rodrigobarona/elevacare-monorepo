import { NextResponse, type NextRequest } from "next/server"
import { signOut } from "@workos-inc/authkit-nextjs"
import { resolveGatewayUrl } from "@eleva/config/env"

/**
 * Always dynamic -- this route deletes the WorkOS session cookie
 * and PKCE verifier cookies. Never prerender, never cache.
 */
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

async function handler(req: NextRequest) {
  await signOut()
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  return NextResponse.redirect(new URL("/", resolveGatewayUrl(host)))
}

export const GET = handler
export const POST = handler
