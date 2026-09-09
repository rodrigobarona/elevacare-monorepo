export const LEGAL_SLUGS = [
  "terms",
  "privacy",
  "health-data",
  "cookies",
  "payments",
  "expert-agreement",
] as const

export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export const LEGAL_PARAGRAPH_KEYS = ["p1", "p2", "p3", "p4", "p5"] as const

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug)
}
