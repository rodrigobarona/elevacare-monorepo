import { resolveGatewayUrl } from "@eleva/config/env"

/** Eleva's public home page, on the gateway (another zone than this app). */
export function publicHomeUrl(): string {
  return `${resolveGatewayUrl().replace(/\/$/, "")}/home`
}
