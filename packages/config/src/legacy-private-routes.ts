import { createWorkspacePath } from "./routing"

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
 * The gateway (`apps/web`) answers these with a redirect that a browser
 * does not keep (302): they were pages behind a sign-in, so a permanent
 * answer gains nothing in search, and one a browser kept could never be
 * taken back if v3 wants the address one day. It drops the query. One
 * thing the MVP put there is read first: `expert=true` on `/register`,
 * its "become an expert" button.
 */

/**
 * Where a person is sent to their own place: signed in, their practice
 * or Space; signed out, the sign-in page.
 */
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
  // "You may not see this page": signed in, home; signed out, sign in.
  unauthorized: OWN_PLACE,

  // Not pages of the MVP, but addresses its own code and emails wrote:
  // where it sent a person after signing out, or after a Google error.
  "sign-in": OWN_PLACE,
  // "Complete your profile", in its welcome email.
  profile: OWN_PLACE,
  // The foot of its emails. v3 keeps what it sends to a person here.
  unsubscribe: "/account/notifications",
} as const satisfies Record<string, string>

/**
 * Addresses under a word v3 still answers, that v3 does not have. Most
 * were written in the MVP's emails and notices (its `notification-links`
 * and webhook handlers) and were never pages of it.
 *
 * `below`: anything under the address, and not the address itself, which
 * is v3's. `from`: the address and anything under it.
 */
export const LEGACY_PRIVATE_PAGES = [
  // v3's `/dashboard` is one address.
  { below: "/dashboard", to: OWN_PLACE },
  // The identity check is part of an expert's set-up.
  { from: "/account/identity", to: OWN_PLACE },
  { from: "/account/verification", to: OWN_PLACE },
  // Password, sessions, two-factor, devices: one page in v3.
  { below: "/account/security", to: "/account/security" },
  // Receipts, a payment to try again, Multibanco, refunds. v3's billing
  // page says where each person's own are. (`/account/billing/return` is
  // v3's, so these are named one by one.)
  { from: "/account/billing/receipts", to: "/account/billing" },
  { from: "/account/billing/retry", to: "/account/billing" },
  { from: "/account/billing/multibanco", to: "/account/billing" },
  { from: "/account/billing/refunds", to: "/account/billing" },
  // An expert's schedule, earnings, payouts and payment account live in
  // their practice.
  { from: "/account/schedule", to: OWN_PLACE },
  { from: "/account/earnings", to: OWN_PLACE },
  { from: "/account/payments", to: OWN_PLACE },
  { from: "/account/connect", to: OWN_PLACE },
  // A person's own details.
  { from: "/account/profile", to: "/account/settings" },
] as const satisfies readonly (
  | { below: string; to: string }
  | { from: string; to: string }
)[]

/**
 * The new address for one of the MVP's signed-in addresses, or null when
 * the path is not one of them. `search` is the query of the old address
 * (`?expert=true`), read for the one case named above.
 */
export function rewriteLegacyPrivatePath(
  pathname: string,
  search = ""
): string | null {
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.toLowerCase())
  const first = segments[0]
  if (!first) return null

  if (Object.hasOwn(LEGACY_PRIVATE_SECTIONS, first)) {
    const section = first as keyof typeof LEGACY_PRIVATE_SECTIONS
    if (
      section === "register" &&
      new URLSearchParams(search).get("expert") === "true"
    ) {
      return createWorkspacePath("expert")
    }
    return LEGACY_PRIVATE_SECTIONS[section]
  }

  const path = `/${segments.join("/")}`
  const moved = LEGACY_PRIVATE_PAGES.find((one) =>
    "below" in one
      ? path.startsWith(`${one.below}/`)
      : path === one.from || path.startsWith(`${one.from}/`)
  )
  return moved?.to ?? null
}
