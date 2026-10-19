import { resolveGatewayUrl } from "@eleva/config/env"

function localePrefix(locale: string): string {
  return locale === "en" ? "" : `/${locale}`
}

/** Public marketplace explorer on the gateway, in the member's locale. */
export function marketplaceExpertsUrl(locale: string): string {
  return `${resolveGatewayUrl()}${localePrefix(locale)}/experts`
}

/** Public expert profile on the gateway, in the member's locale. */
export function expertProfileUrl(locale: string, username: string): string {
  return `${resolveGatewayUrl()}${localePrefix(locale)}/${encodeURIComponent(username)}`
}
