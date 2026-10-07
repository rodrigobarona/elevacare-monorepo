export type PublicSiteNavItem = {
  href: string
  labelKey: "experts" | "about" | "becomeExpert" | "forClinics"
}

/** Shared desktop + mobile links for every public marketing page. */
export const PUBLIC_SITE_NAV: readonly PublicSiteNavItem[] = [
  { href: "/experts", labelKey: "experts" },
  { href: "/about", labelKey: "about" },
  { href: "/become-expert", labelKey: "becomeExpert" },
  { href: "/for-clinics", labelKey: "forClinics" },
]
