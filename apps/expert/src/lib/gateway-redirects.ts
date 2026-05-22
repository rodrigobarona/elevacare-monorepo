import { redirect } from "next/navigation"
import { resolveGatewayUrl } from "@eleva/config/env"

/** Member app home for an org slug — always via gateway (multi-zone safe). */
export function redirectToMemberOrg(orgSlug: string): never {
  redirect(`${resolveGatewayUrl()}/${orgSlug}`)
}
