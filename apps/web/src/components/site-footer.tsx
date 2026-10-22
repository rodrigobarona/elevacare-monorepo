import { PublicSiteFooter } from "@eleva/site-chrome/public-site-footer"
import { getLocale } from "next-intl/server"

export async function SiteFooter() {
  const locale = await getLocale()
  return <PublicSiteFooter locale={locale} />
}
