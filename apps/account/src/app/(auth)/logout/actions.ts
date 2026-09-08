"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { isAlreadySignedOut } from "@eleva/auth"
import { getAuthApi } from "@eleva/auth/server/auth"
import { resolveGatewayUrl } from "@eleva/config/env"

export async function logoutAction() {
  const hdrs = await headers()
  try {
    await getAuthApi().signOut({ headers: hdrs })
  } catch (err) {
    if (!isAlreadySignedOut(err)) throw err
  }
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host")
  redirect(resolveGatewayUrl(host))
}
