import { defaultLocale, type Locale } from "@eleva/config/i18n"
import { resolveGatewayUrl } from "@eleva/config/env"

/** Absolute marketing URL on the gateway (cross-zone from apps/docs). */
export function gatewayMarketingPath(locale: Locale, pathname: string): string {
  const base = resolveGatewayUrl().replace(/\/$/, "")
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  const prefix = locale === defaultLocale ? "" : `/${locale}`
  return `${base}${prefix}${path}`
}
