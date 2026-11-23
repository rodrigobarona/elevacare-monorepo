/**
 * Where the MVP's signed-in addresses go in v3 (slice 14.22).
 *
 * In the MVP an expert's working pages sat at the root of the site:
 * `/appointments`, `/booking/schedule`, `/setup`. In v3 each practice has
 * its own address (`/expert/{slug}`, ADR-026), which only the session
 * knows, so those pages go to `/dashboard`: it sends a signed-in person
 * to their own practice or Space, and anyone else to sign in.
 *
 * A bookmark, an old email or a calendar note that points at one of these
 * lands somewhere useful, not on "page not found" or, worse, on the public
 * profile of whoever took the word as a username. Every first word here
 * is a reserved username (`./reserved-usernames.ts`); a test holds that.
 *
 * The MVP's public addresses are in `./public-site-parity.ts`. Its
 * `/login`, `/onboarding`, `/dashboard`, `/account/billing`,
 * `/account/notifications`, `/account/security` and `/admin/*` are
 * addresses v3 serves itself, and are left alone.
 *
 * The gateway (`apps/web`) answers these with a permanent redirect and
 * drops the query: nothing the MVP put there means anything to v3.
 */

/** Where a signed-in person is sent to their own place. */
const OWN_PLACE = "/dashboard"

/**
 * Addresses that moved, whatever comes after the first word:
 * `/appointments`, `/appointments/patients/123`, `/booking/events/new`.
 */
export const LEGACY_PRIVATE_SECTIONS = {
  // Sessions, the people an expert sees, their records.
  appointments: OWN_PLACE,
  // Services, the expert's public profile, the schedule and its limits.
  booking: OWN_PLACE,
  // The expert's set-up checklist: v3 picks it up where it stands.
  setup: OWN_PLACE,
  // Creating an account.
  register: "/signup",
  // "You may not see this page": signing in again is the way forward.
  unauthorized: "/login",
} as const satisfies Record<string, string>

/**
 * Addresses under a word v3 still serves, that v3 does not have:
 * `/dashboard/subscription` (v3's `/dashboard` is one address),
 * `/account/identity` (the identity check is part of an expert's set-up).
 * Each is `[first word, second word or "*" for any]`.
 */
export const LEGACY_PRIVATE_PAGES = [
  { under: "dashboard", page: "*", to: OWN_PLACE },
  { under: "account", page: "identity", to: OWN_PLACE },
] as const

/**
 * The new address for one of the MVP's signed-in addresses, or null when
 * the path is not one of them.
 */
export function rewriteLegacyPrivatePath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]?.toLowerCase()
  if (!first) return null

  if (Object.hasOwn(LEGACY_PRIVATE_SECTIONS, first)) {
    return LEGACY_PRIVATE_SECTIONS[
      first as keyof typeof LEGACY_PRIVATE_SECTIONS
    ]
  }

  const second = segments[1]?.toLowerCase()
  if (!second) return null
  const moved = LEGACY_PRIVATE_PAGES.find(
    (one) => one.under === first && (one.page === "*" || one.page === second)
  )
  return moved?.to ?? null
}

/** Every first word this module answers for. */
export const LEGACY_PRIVATE_FIRST_SEGMENTS = [
  ...Object.keys(LEGACY_PRIVATE_SECTIONS),
  ...LEGACY_PRIVATE_PAGES.map((one) => one.under),
] as const
