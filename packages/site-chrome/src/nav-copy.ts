import { PUBLIC_SITE_NAV, type SiteNavLink } from "./public-site-nav"

/** Serializable nav strings for client mega-menu panels (no function props). */
export type NavCopyRecords = {
  nav: Record<string, string>
  home: Record<string, string>
}

function putLink(
  link: SiteNavLink,
  nav: Record<string, string>,
  home: Record<string, string>,
  translateNav: (key: string) => string,
  translateHome: (key: string) => string
) {
  const bucket = link.namespace === "home" ? home : nav
  const t = link.namespace === "home" ? translateHome : translateNav
  bucket[link.titleKey] = t(link.titleKey)
  bucket[link.descriptionKey] = t(link.descriptionKey)
}

/** Resolve all mega-menu strings on the server before passing to client components. */
export function buildNavCopyRecords(
  translateNav: (key: string) => string,
  translateHome: (key: string) => string
): NavCopyRecords {
  const nav: Record<string, string> = {}
  const home: Record<string, string> = {}

  for (const menu of PUBLIC_SITE_NAV) {
    nav[`menu.${menu.id}.trigger`] = translateNav(`menu.${menu.id}.trigger`)
    nav[`menu.${menu.id}.heading`] = translateNav(`menu.${menu.id}.heading`)
    nav[`menu.${menu.id}.featuredTitle`] = translateNav(
      `menu.${menu.id}.featuredTitle`
    )
    nav[`menu.${menu.id}.featuredDescription`] = translateNav(
      `menu.${menu.id}.featuredDescription`
    )
    for (const link of menu.links) {
      putLink(link, nav, home, translateNav, translateHome)
    }
    if (menu.footerLink) {
      putLink(menu.footerLink, nav, home, translateNav, translateHome)
    }
  }

  return { nav, home }
}

export function navString(
  copy: NavCopyRecords,
  link: SiteNavLink,
  field: "titleKey" | "descriptionKey"
): string {
  const bucket = link.namespace === "home" ? copy.home : copy.nav
  return bucket[link[field]] ?? link[field]
}
