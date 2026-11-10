import type { ContentLinkOptions } from "./mdx-components"

const PORTAL_LINK = /^\/(?:members|experts|clinics)(?=[/?#]|$)/
const LOCALE_PORTAL_LINK =
  /^\/(?:pt|es)\/(?:members|experts|clinics)(?=[/?#]|$)/
const ELEVA_SITE = /^https:\/\/(?:www\.)?eleva\.care(?=[/?#]|$)/

/**
 * Help MDX writes links the way an author thinks of them: `/experts/…` for
 * another help page and `https://eleva.care/…` for the public site. In the
 * help center that means: keep the reader's language on help links (the
 * docs app's `/docs` basePath is added by Next), and send site links to the
 * site this deployment belongs to (dev.eleva.care today, eleva.care after
 * the apex cutover).
 *
 * @param localePrefix `""` for English, `"/pt"` or `"/es"` otherwise.
 * @param siteOrigin The public site origin, e.g. `https://dev.eleva.care`.
 */
export function helpLinkOptions(
  localePrefix: string,
  siteOrigin: string
): ContentLinkOptions {
  const origin = siteOrigin.replace(/\/$/, "")
  return {
    siteOrigin: origin,
    resolveHref: (href) => {
      if (LOCALE_PORTAL_LINK.test(href)) return href
      if (PORTAL_LINK.test(href)) return `${localePrefix}${href}`
      if (ELEVA_SITE.test(href)) return href.replace(ELEVA_SITE, origin)
      return href
    },
  }
}
