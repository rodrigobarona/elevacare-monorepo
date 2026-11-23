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
 * profile of whoever took the word as a username. Every first word in
 * `LEGACY_PRIVATE_SECTIONS` is a reserved username: `./reserved-usernames.ts`
 * takes them from here.
 *
 * The MVP's public addresses are in `./public-site-parity.ts`. Its
 * `/login`, `/onboarding`, `/dashboard`, `/account/billing`,
 * `/account/notifications`, `/account/security` and `/admin/*` are
 * addresses v3 answers itself, and are left alone.
 *
 * The gateway (`apps/web`) answers these with a redirect and drops the
 * query. One thing the MVP put there is read first: `expert=true` on
 * `/register`, its "become an expert" button.
 */

/** Where a signed-in person is sent to their own place. */
const OWN_PLACE = "/dashboard"

/** Where v3's own "become an expert" button goes. */
const BECOME_EXPERT = "/account/workspaces/create/expert"

/**
 * Addresses that moved, whatever comes after the first word:
 * `/appointments`, `/appointments/patients/123`, `/booking/events/new`.
 * v3 does not use these words again, so the redirect is permanent.
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

  // Not pages of the MVP, but addresses its own code and emails wrote:
  // where it sent a person after signing out, or after a Google error.
  "sign-in": "/login",
  // "Complete your profile", in its welcome email.
  profile: OWN_PLACE,
  // The foot of its emails. v3 keeps what it sends to a person here.
  unsubscribe: "/account/notifications",
} as const satisfies Record<string, string>

/**
 * Addresses under a word v3 still answers, that v3 does not have:
 * `/dashboard/subscription` (v3's `/dashboard` is one address),
 * `/account/identity` (the identity check is part of an expert's set-up).
 * `page` is the second word, or "*" for any.
 *
 * The word is v3's and v3 may build under it one day, so this redirect is
 * not permanent: a browser must not remember it for good.
 */
export const LEGACY_PRIVATE_PAGES = [
  { under: "dashboard", page: "*", to: OWN_PLACE },
  { under: "account", page: "identity", to: OWN_PLACE },
] as const

/** Where one of the MVP's addresses went, and whether for good. */
export interface LegacyPrivateMove {
  to: string
  /** False where v3 may one day have a page at the old address. */
  permanent: boolean
}

/**
 * The new address for one of the MVP's signed-in addresses, or null when
 * the path is not one of them. `search` is the query of the old address
 * (`?expert=true`), read for the one case named above.
 */
export function rewriteLegacyPrivatePath(
  pathname: string,
  search = ""
): LegacyPrivateMove | null {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]?.toLowerCase()
  if (!first) return null

  if (Object.hasOwn(LEGACY_PRIVATE_SECTIONS, first)) {
    const section = first as keyof typeof LEGACY_PRIVATE_SECTIONS
    const becomingExpert =
      section === "register" &&
      new URLSearchParams(search).get("expert") === "true"
    return {
      to: becomingExpert ? BECOME_EXPERT : LEGACY_PRIVATE_SECTIONS[section],
      permanent: true,
    }
  }

  const second = segments[1]?.toLowerCase()
  if (!second) return null
  const moved = LEGACY_PRIVATE_PAGES.find(
    (one) => one.under === first && (one.page === "*" || one.page === second)
  )
  return moved ? { to: moved.to, permanent: false } : null
}
