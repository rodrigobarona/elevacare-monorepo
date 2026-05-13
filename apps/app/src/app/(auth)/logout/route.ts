import { NextResponse, type NextRequest } from "next/server"
import { signOut } from "@workos-inc/authkit-nextjs"

/**
 * Sign-out route. Revokes the WorkOS session + clears the cookie.
 * Accepts both GET (browser link) and POST (form submission).
 */
async function handler(_req: NextRequest) {
  await signOut()
  return NextResponse.redirect(new URL("/signin", _req.url))
}

export const GET = handler
export const POST = handler
