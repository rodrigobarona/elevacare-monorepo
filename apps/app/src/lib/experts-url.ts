import { resolveGatewayUrl } from "@eleva/config/env"

/** Public marketplace explorer on the gateway, in the member's locale. */
export function marketplaceExpertsUrl(locale: string): string {
  const path = locale === "en" ? "/experts" : `/${locale}/experts`
  return `${resolveGatewayUrl()}${path}`
}
