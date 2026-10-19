/**
 * Public expert profile content shared by the database types, API schemas and
 * the profile UI.
 */

export const SOCIAL_LINK_KINDS = [
  "website",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "facebook",
] as const

export type SocialLinkKind = (typeof SOCIAL_LINK_KINDS)[number]

export const PROFILE_CONTENT_LIMITS = {
  socialLinks: SOCIAL_LINK_KINDS.length,
  credentials: 10,
  credentialText: 160,
  listItems: 8,
  listItemText: 200,
  url: 500,
} as const

const SOCIAL_LINK_HOSTS: Record<
  Exclude<SocialLinkKind, "website">,
  readonly string[]
> = {
  instagram: ["instagram.com"],
  linkedin: ["linkedin.com"],
  youtube: ["youtube.com", "youtu.be"],
  tiktok: ["tiktok.com"],
  facebook: ["facebook.com"],
}

function hostMatches(host: string, allowed: readonly string[]): boolean {
  return allowed.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  )
}

/** HTTPS only; platform links must point at that platform's domain. */
export function isAllowedSocialLinkUrl(
  kind: SocialLinkKind,
  url: string
): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return false
  }
  const host = parsed.hostname.toLowerCase()
  switch (kind) {
    case "website":
      return host.includes(".")
    case "instagram":
    case "linkedin":
    case "youtube":
    case "tiktok":
    case "facebook":
      return hostMatches(host, SOCIAL_LINK_HOSTS[kind])
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}
