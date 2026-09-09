/** Mirrors `EXPERT_CATEGORY_SEEDS` in `@eleva/db` seed. */
export const MARKETPLACE_CATEGORY_SLUGS = [
  "psychology",
  "nutrition",
  "physiotherapy",
  "midwifery",
  "pelvic-health",
  "lactation",
  "fertility",
  "mental-health-coaching",
  "wellness",
] as const

export type MarketplaceCategorySlug =
  (typeof MARKETPLACE_CATEGORY_SLUGS)[number]

export function isMarketplaceCategory(
  slug: string
): slug is MarketplaceCategorySlug {
  return (MARKETPLACE_CATEGORY_SLUGS as readonly string[]).includes(slug)
}
