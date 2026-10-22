export const TRUST_SLUGS = ["security", "dpa", "sub-processors", "ers"] as const

export type TrustSlug = (typeof TRUST_SLUGS)[number]

export function isTrustSlug(slug: string): slug is TrustSlug {
  return (TRUST_SLUGS as readonly string[]).includes(slug)
}
