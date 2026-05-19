import { NextResponse } from "next/server"
import { refreshSessionEntitlements } from "@eleva/auth/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  await refreshSessionEntitlements()

  const url = new URL(request.url)
  const redirectUrl = new URL("/account/billing", url.origin)
  const checkoutSessionId = url.searchParams.get("checkout_session_id")
  if (checkoutSessionId) {
    redirectUrl.searchParams.set("checkout_session_id", checkoutSessionId)
  }

  return NextResponse.redirect(redirectUrl)
}
