/** Public legal document slugs (SSOT for footer and `/legal/[slug]` routes). */
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

export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug)
}
