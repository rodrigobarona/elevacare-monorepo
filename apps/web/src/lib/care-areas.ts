/**
 * Care areas promoted on the public site (home services grid, header menu,
 * About facts). Titles and descriptions live under `home.services.<key>`.
 */
export const CARE_AREAS = [
  {
    key: "pregnancy",
    slug: "service-pregnancy",
    href: "/experts/midwifery",
  },
  {
    key: "pelvicHealth",
    slug: "service-pelvic-health",
    href: "/experts/pelvic-health",
  },
  {
    key: "everyStage",
    slug: "service-every-stage",
    href: "/experts/wellness",
  },
  {
    key: "cancerJourney",
    slug: "service-cancer-journey",
    href: "/experts/physiotherapy",
  },
] as const

export type CareArea = (typeof CARE_AREAS)[number]
