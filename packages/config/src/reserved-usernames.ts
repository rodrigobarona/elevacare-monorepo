/**
 * Reserved usernames / clinic slugs.
 *
 * Source of truth: docs/eleva-v3/identity-rbac-spec.md (Usernames And
 * Public Slugs). Any new first-segment path on the gateway must be
 * added here BEFORE the route ships. CI drift check compares this
 * list against the gateway's route manifest.
 *
 * Format rules enforced separately by isValidUsername():
 * - 3–30 characters
 * - lowercase [a-z0-9-]
 * - no leading/trailing hyphen
 * - no consecutive hyphens
 */

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // Authenticated routes at the root (ADR-014 revised)
  "patient",
  "expert",
  "org",
  "admin",
  "settings",
  "callback",
  "logout",

  // Zone-rewrite prefixes
  "docs",

  // Locale codes + locale-country shortcuts
  "pt",
  "es",
  "en",
  "br",

  // Marketing + marketplace
  "home",
  "about",
  "legal",
  "privacy",
  "terms",
  "cookies",
  "blog",
  "experts",
  "categories",
  "become-partner",
  "clinics",
  "partners",
  "careers",
  "pricing",

  // Help
  "help",
  "support",
  "faq",
  "contact",

  // Auth + system
  "auth",
  "signin",
  "signup",
  "login",
  "dashboard",

  // Infra
  "_next",
  "_vercel",
  "vercel",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.json",

  // Future surfaces kept for phase-2 (never let a user grab these)
  "academy",
  "courses",
  "teams",

  // Branded subresources / subdomains (collide with email/dns hygiene)
  "www",
  "mail",
  "status",
  "sessions",
  "email",
  "api",
  "app",
])

export function isReserved(name: string): boolean {
  return RESERVED_USERNAMES.has(name.toLowerCase())
}

/**
 * Validates username format per identity-rbac-spec.md. Returns null on
 * success or a machine-readable error code.
 */
export type UsernameError =
  | "too-short"
  | "too-long"
  | "invalid-chars"
  | "leading-hyphen"
  | "trailing-hyphen"
  | "consecutive-hyphens"
  | "reserved"

export function validateUsername(raw: string): UsernameError | null {
  const name = raw.toLowerCase()
  if (name.length < 3) return "too-short"
  if (name.length > 30) return "too-long"
  if (!/^[a-z0-9-]+$/.test(name)) return "invalid-chars"
  if (name.startsWith("-")) return "leading-hyphen"
  if (name.endsWith("-")) return "trailing-hyphen"
  if (name.includes("--")) return "consecutive-hyphens"
  if (isReserved(name)) return "reserved"
  return null
}
