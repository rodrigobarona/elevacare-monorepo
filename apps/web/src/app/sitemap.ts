import type { MetadataRoute } from "next"
import { locales } from "@eleva/config/i18n"
import { localePath } from "@/lib/hreflang"

const PATHS = ["/", "/about", "/experts"] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.flatMap((pathname) =>
    locales.map((locale) => ({
      url: localePath(locale, pathname),
      lastModified: new Date(),
    }))
  )
}
