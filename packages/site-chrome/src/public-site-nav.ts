import { CARE_AREAS } from "./care-areas"

export type SiteNavIcon =
  | "search"
  | "stethoscope"
  | "buildings"
  | "info"
  | "book"
  | "envelope"

export type SiteNavLink = {
  href: string
  /** `nav.*` key, or `home.*` when `namespace` is `"home"`. */
  titleKey: string
  descriptionKey: string
  namespace?: "home"
} & ({ imageSlug: string } | { icon: SiteNavIcon })

export type SiteNavMenu = {
  id: "care" | "professionals" | "company" | "learn"
  /** Path prefixes that mark this menu's trigger as the current section. */
  matches: readonly string[]
  links: readonly SiteNavLink[]
  footerLink?: SiteNavLink
  featured: { href: string; imageSlug: string }
}

/** Header menus shared by the desktop mega menu and the mobile sheet. */
export const PUBLIC_SITE_NAV: readonly SiteNavMenu[] = [
  {
    id: "care",
    matches: ["/experts"],
    links: CARE_AREAS.map((area) => ({
      href: area.href,
      titleKey: `services.${area.key}.title`,
      descriptionKey: `services.${area.key}.description`,
      namespace: "home" as const,
      imageSlug: area.slug,
    })),
    footerLink: {
      href: "/experts",
      titleKey: "menu.care.browseAll",
      descriptionKey: "menu.care.browseAllDescription",
      icon: "search",
    },
    featured: { href: "/experts", imageSlug: "online-session-mature" },
  },
  {
    id: "professionals",
    matches: ["/become-expert", "/for-clinics"],
    links: [
      {
        href: "/become-expert",
        titleKey: "becomeExpert",
        descriptionKey: "menu.professionals.becomeExpertDescription",
        icon: "stethoscope",
      },
      {
        href: "/for-clinics",
        titleKey: "forClinics",
        descriptionKey: "menu.professionals.forClinicsDescription",
        icon: "buildings",
      },
    ],
    featured: { href: "/become-expert", imageSlug: "expert-at-desk" },
  },
  {
    id: "company",
    matches: ["/about", "/history", "/contact"],
    links: [
      {
        href: "/about",
        titleKey: "about",
        descriptionKey: "menu.company.aboutDescription",
        icon: "info",
      },
      {
        href: "/history",
        titleKey: "menu.company.story",
        descriptionKey: "menu.company.storyDescription",
        icon: "book",
      },
      {
        href: "/contact",
        titleKey: "menu.company.contact",
        descriptionKey: "menu.company.contactDescription",
        icon: "envelope",
      },
    ],
    featured: { href: "/about", imageSlug: "founders-photo" },
  },
  {
    id: "learn",
    matches: [
      "/newsletter",
      "/podcast",
      "/community",
      "/evidence-based-care",
      "/docs",
      "/academy",
    ],
    links: [
      {
        href: "/academy",
        titleKey: "menu.learn.academy",
        descriptionKey: "menu.learn.academyDescription",
        icon: "book",
      },
      {
        href: "/newsletter",
        titleKey: "menu.learn.newsletter",
        descriptionKey: "menu.learn.newsletterDescription",
        icon: "envelope",
      },
      {
        href: "/podcast",
        titleKey: "menu.learn.podcast",
        descriptionKey: "menu.learn.podcastDescription",
        icon: "info",
      },
      {
        href: "/community",
        titleKey: "menu.learn.community",
        descriptionKey: "menu.learn.communityDescription",
        icon: "search",
      },
      {
        href: "/docs",
        titleKey: "menu.learn.help",
        descriptionKey: "menu.learn.helpDescription",
        icon: "book",
      },
      {
        href: "/evidence-based-care",
        titleKey: "menu.learn.evidence",
        descriptionKey: "menu.learn.evidenceDescription",
        icon: "stethoscope",
      },
    ],
    footerLink: {
      href: "/newsletter",
      titleKey: "menu.learn.newsletter",
      descriptionKey: "menu.learn.newsletterDescription",
      icon: "envelope",
    },
    featured: {
      href: "/evidence-based-care",
      imageSlug: "online-session-mature",
    },
  },
]
