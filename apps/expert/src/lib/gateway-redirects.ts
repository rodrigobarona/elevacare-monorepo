import { redirect } from "next/navigation"
import { resolveGatewayUrl } from "@eleva/config/env"

/**
 * Leave the expert tools for the person's home: the gateway's /dashboard
 * picks their last active workspace (multi-zone safe). `/{slug}` would be the
 * public profile, not a dashboard.
 */
export function redirectToDashboard(): never {
  redirect(`${resolveGatewayUrl()}/dashboard`)
}
