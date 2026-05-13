import { isReserved, validateUsername } from "./reserved-usernames"

/**
 * Convert a display name into a URL-safe slug.
 *
 * Strips non-ASCII, collapses whitespace into hyphens, trims edge hyphens,
 * and clamps to 30 characters (matching the username/slug validation rules).
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30)
    .replace(/-$/, "") // re-trim if slice cut mid-hyphen
}

/**
 * Generate a unique org slug from a display name.
 *
 * 1. Slugifies the name
 * 2. Falls back to "org" if the result is empty or too short
 * 3. Checks the reserved-names list
 * 4. Queries `existingSlugs` for collisions, appending -2, -3, etc.
 *
 * `existingSlugs` is a lookup function so the caller can inject a DB query
 * without this package depending on `@eleva/db`.
 */
export async function generateUniqueOrgSlug(
  name: string,
  existingSlugs: (candidates: string[]) => Promise<Set<string>>
): Promise<string> {
  let base = slugify(name)
  if (base.length < 3) base = "org"

  const candidates: string[] = [base]
  for (let i = 2; i <= 20; i++) {
    const suffixed = `${base}-${i}`.slice(0, 30)
    candidates.push(suffixed)
  }

  const validCandidates = candidates.filter(
    (c) => validateUsername(c) === null || !isReserved(c)
  )

  if (validCandidates.length === 0) {
    const fallback = `org-${Date.now().toString(36).slice(-6)}`
    return fallback
  }

  const taken = await existingSlugs(validCandidates)

  for (const candidate of validCandidates) {
    if (!taken.has(candidate)) {
      return candidate
    }
  }

  const fallback = `${base}-${Date.now().toString(36).slice(-6)}`.slice(0, 30)
  return fallback
}
