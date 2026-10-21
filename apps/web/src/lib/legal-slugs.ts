export const LEGAL_SLUGS = [
  "terms",
  "privacy",
  "health-data",
  "ai-processing",
  "cookies",
  "payments",
  "expert-agreement",
  "accessibility",
  "complaints",
] as const

/** Slugs rendered from `@eleva/content` MDX (final text). Others stay on JSON until ported. */
export const LEGAL_MDX_SLUGS = ["accessibility", "complaints"] as const

export type LegalMdxSlug = (typeof LEGAL_MDX_SLUGS)[number]

export function isLegalMdxSlug(slug: string): slug is LegalMdxSlug {
  return (LEGAL_MDX_SLUGS as readonly string[]).includes(slug)
}

export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export const LEGAL_PARAGRAPH_KEYS = ["p1", "p2", "p3", "p4", "p5"] as const

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug)
}
