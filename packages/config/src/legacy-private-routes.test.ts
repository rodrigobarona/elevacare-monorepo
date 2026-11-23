import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  LEGACY_PRIVATE_PAGES,
  LEGACY_PRIVATE_SECTIONS,
  rewriteLegacyPrivatePath,
} from "./legacy-private-routes"
import { rewriteParityPath } from "./public-site-parity"
import { isReserved } from "./reserved-usernames"
import { resolveDispatch } from "./dispatch"
import {
  APP_REWRITE_PATHS,
  createWorkspacePath,
  WEB_MARKETING_PATHS,
  WORKSPACE_NAMESPACES,
} from "./routing"
import { locales } from "./i18n-locales"

const REPOSITORY = join(import.meta.dirname, "../../..")

/**
 * The addresses of an app directory: a folder with `page.tsx` or
 * `route.ts`. A group in brackets is not part of the address, and a
 * slot (`@modal`) draws over another page without an address of its own.
 */
function addresses(dir: string, base = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("@")) return []
      const part = /^\(.*\)$/.test(entry.name) ? "" : `/${entry.name}`
      return addresses(join(dir, entry.name), `${base}${part}`)
    }
    return entry.name === "page.tsx" || entry.name === "route.ts"
      ? [base || "/"]
      : []
  })
}

/** Whether a list of addresses has this one: `[type]` is any one word. */
function serves(served: string[], path: string): boolean {
  const words = path.split("/")
  return served.some((address) => {
    const parts = address.split("/")
    return (
      parts.length === words.length &&
      parts.every(
        (part, at) => /^\[[^.\]]+\]$/.test(part) || part === words[at]
      )
    )
  })
}

/** What the account app answers today, read from its own folders. */
const ACCOUNT_APP = addresses(join(REPOSITORY, "apps/account/src/app"))

/** The MVP's signed-in addresses that v3 answers itself, at the same path. */
const V3_SERVES = [
  "/account",
  "/account/billing",
  "/account/notifications",
  "/account/security",
  "/dashboard",
  "/login",
  "/onboarding",
]

/**
 * Staff pages. v3 sends `/admin/*` to the staff console's own host, and
 * nothing here checks what that console answers: its pages are Phase 12's.
 */
const isStaffPage = (path: string) => path.startsWith("/admin/")

const to = rewriteLegacyPrivatePath

describe("where the MVP's signed-in addresses go", () => {
  it.each([
    // An expert's working pages.
    ["/appointments", "/dashboard"],
    ["/appointments/patients", "/dashboard"],
    ["/appointments/patients/8f1c2d", "/dashboard"],
    ["/appointments/records", "/dashboard"],
    ["/booking/events", "/dashboard"],
    ["/booking/events/new", "/dashboard"],
    ["/booking/events/first-visit/edit", "/dashboard"],
    ["/booking/expert", "/dashboard"],
    ["/booking/schedule", "/dashboard"],
    ["/booking/schedule/limits", "/dashboard"],
    ["/setup", "/dashboard"],
    // Pages under a word v3 still answers.
    ["/dashboard/subscription", "/dashboard"],
    ["/dashboard/widgets-kitchen-sink", "/dashboard"],
    ["/account/identity", "/dashboard"],
    ["/account/identity/callback", "/dashboard"],
    ["/account/identity/success", "/dashboard"],
    // Creating an account, and "you may not see this".
    ["/register", "/signup"],
    ["/unauthorized", "/dashboard"],
    // Written in the MVP's own code and emails.
    ["/sign-in", "/dashboard"],
    ["/profile", "/dashboard"],
    ["/profile/complete", "/dashboard"],
    ["/unsubscribe", "/account/notifications"],
    // Written in its notices, under a word v3 still answers.
    ["/account/security/password", "/account/security"],
    ["/account/security/sessions", "/account/security"],
    ["/account/security/two-factor", "/account/security"],
    ["/account/security/devices", "/account/security"],
    ["/account/billing/receipts", "/account/billing"],
    ["/account/billing/receipts/pi_3Q", "/account/billing"],
    ["/account/billing/retry/pi_3Q", "/account/billing"],
    ["/account/billing/multibanco", "/account/billing"],
    ["/account/billing/refunds/re_1", "/account/billing"],
    ["/account/earnings", "/dashboard"],
    ["/account/earnings/payouts/po_1", "/dashboard"],
    ["/account/payments", "/dashboard"],
    ["/account/connect", "/dashboard"],
    ["/account/verification", "/dashboard"],
    ["/account/schedule", "/dashboard"],
    ["/account/profile", "/account/settings"],
    // As typed: a slash at the end, capitals, a slash too many.
    ["/appointments/", "/dashboard"],
    ["/Booking/Schedule", "/dashboard"],
    ["/DASHBOARD/Subscription", "/dashboard"],
    ["/Account/Identity/", "/dashboard"],
    ["//appointments", "/dashboard"],
    ["/account//identity", "/dashboard"],
  ])("%s goes to %s", (from, where) => {
    expect(to(from)).toBe(where)
  })

  it("sends the MVP's \"become an expert\" button to v3's", () => {
    const expert = createWorkspacePath("expert")
    expect(expert).toBe("/account/workspaces/create/expert")
    expect(to("/register", "?expert=true")).toBe(expert)
    expect(to("/register", "?expert=true&plan=community-paygo")).toBe(expert)
    expect(to("/register/", "?plan=top-annual&expert=true")).toBe(expert)
    // Only that word, said that way, and only there.
    expect(to("/register", "?expert=false")).toBe("/signup")
    expect(to("/register", "?plan=top-annual")).toBe("/signup")
    expect(to("/register", "")).toBe("/signup")
    expect(to("/unauthorized", "?expert=true")).toBe("/dashboard")
    expect(to("/appointments", "?expert=true")).toBe("/dashboard")
  })

  it.each([
    "/",
    "/dashboard",
    // With a slash at the end it is still v3's one address, not a page
    // under it: moving it would send `/dashboard` to itself.
    "/dashboard/",
    "/login",
    "/signup",
    "/onboarding",
    "/onboarding/continue",
    "/account",
    "/account/",
    "/account/settings",
    "/account/billing",
    "/account/billing/return",
    "/account/notifications",
    "/account/billing/returned",
    "/account/security",
    "/account/security/",
    "/account/privacy",
    "/account/organizations",
    "/account/workspaces/new",
    "/account/workspaces/create/expert",
    "/space",
    "/expert/fisiomota/sessions",
    "/team/lumen/billing",
    "/admin/clinics",
    "/experts",
    "/pt/experts",
    "/fisiomota",
    "/fisiomota/first-visit",
    "/pt/fisiomota/first-visit",
  ])("%s is an address of v3, and is left alone", (path) => {
    expect(rewriteLegacyPrivatePath(path)).toBeNull()
  })

  it.each([
    "/bookings",
    "/booking-studio",
    "/appointmentsclinic",
    "/setupstudio",
    "/registered",
    "/profiles",
    "/sign-in-help",
    "/unsubscribed",
    "/account/identity-check",
    "/account/identities",
    "/account/profiles",
    "/account/billing/receipt",
    "/account/security-keys",
    // A locale in front was never one of the MVP's signed-in addresses.
    "/pt/appointments",
    "/es/booking/schedule",
    "/en/register",
    "/pt/dashboard/subscription",
    "/pt/account/identity",
    "/pt/account/security/password",
  ])("%s only begins like one, and is left alone", (path) => {
    expect(rewriteLegacyPrivatePath(path)).toBeNull()
  })

  it("sends every one of them to a page the account app has", () => {
    const targets = new Set<string>([
      ...Object.values(LEGACY_PRIVATE_SECTIONS),
      ...LEGACY_PRIVATE_PAGES.map((one) => one.to),
      to("/register", "?expert=true")!,
    ])
    const origins = {
      app: "app",
      expert: "expert",
      team: "team",
      academy: "academy",
      account: "account",
      docs: "docs",
    }
    for (const target of targets) {
      // Not moved again, answered by the account zone, and there.
      expect(rewriteLegacyPrivatePath(target), target).toBeNull()
      expect(rewriteParityPath(target), target).toBeNull()
      expect(resolveDispatch(target, origins), target).toEqual({
        kind: "rewrite",
        origin: "account",
      })
      expect(serves(ACCOUNT_APP, target), target).toBe(true)
    }
  })

  it("moves no address the account app has", () => {
    // Read from its folders, so a page added there later under one of
    // these words fails here and not in front of a visitor.
    for (const address of ACCOUNT_APP) {
      const example = address.replace(/\[[^\]]+\]/g, "example")
      expect(rewriteLegacyPrivatePath(example), address).toBeNull()
      expect(rewriteLegacyPrivatePath(`${example}/`), address).toBeNull()
    }
  })

  it("moves no first word the gateway gives to an app or to the public site", () => {
    // The rule runs before the gateway decides whose address it is, so a
    // word in both places would be moved without anyone noticing.
    const live = new Set<string>([
      ...APP_REWRITE_PATHS,
      ...WEB_MARKETING_PATHS,
      ...WORKSPACE_NAMESPACES,
      ...locales,
      "docs",
      "admin",
    ])
    for (const word of Object.keys(LEGACY_PRIVATE_SECTIONS)) {
      expect(live.has(word), word).toBe(false)
    }
    // And the words whose pages are moved one by one are the account
    // app's: nothing else is touched under any other first word.
    for (const one of LEGACY_PRIVATE_PAGES) {
      const first = ("below" in one ? one.below : one.from).split("/")[1]
      expect(["dashboard", "account"], first).toContain(first)
    }
  })

  it("no first word of theirs can be taken as a username", () => {
    for (const word of Object.keys(LEGACY_PRIVATE_SECTIONS)) {
      expect(isReserved(word), word).toBe(true)
    }
    expect(isReserved("dashboard")).toBe(true)
    expect(isReserved("account")).toBe(true)
    // And the two that are written like `sign-in`.
    expect(isReserved("sign-up")).toBe(true)
    expect(isReserved("sign-out")).toBe(true)
  })
})

describe("the account app's own list of addresses", () => {
  it("is read from its folders", () => {
    expect(ACCOUNT_APP.length).toBeGreaterThanOrEqual(15)
    expect(serves(ACCOUNT_APP, "/login")).toBe(true)
    expect(serves(ACCOUNT_APP, createWorkspacePath("team"))).toBe(true)
    expect(serves(ACCOUNT_APP, "/account/workspaces/create")).toBe(false)
    expect(serves(ACCOUNT_APP, "/no-such-page")).toBe(false)
  })

  it("has every address named here as one v3 answers itself", () => {
    for (const path of V3_SERVES) {
      expect(serves(ACCOUNT_APP, path), path).toBe(true)
    }
  })
})

describe("the MVP's own list of routes", () => {
  // The snapshot of the MVP kept in the repository: its signed-in pages
  // are the folders `(app)` and `(auth)` of its app directory.
  const app = join(REPOSITORY, "_context/clone-repo/eleva-care-app/src/app")
  const pages = (group: string) => addresses(join(app, group))

  it("is in the repository", () => {
    expect(existsSync(join(app, "(app)"))).toBe(true)
    expect(existsSync(join(app, "(auth)"))).toBe(true)
  })

  it("has no signed-in page that is neither moved nor answered by v3", () => {
    const signedIn = [...pages("(app)"), ...pages("(auth)")].sort()
    expect(signedIn.length).toBeGreaterThanOrEqual(25)

    const forgotten = signedIn.filter((path) => {
      // `[id]` in a folder name is one part of an address.
      const example = path.replace(/\[[^\]]+\]/g, "example")
      return (
        rewriteLegacyPrivatePath(example) === null &&
        !V3_SERVES.includes(path) &&
        !isStaffPage(path)
      )
    })
    expect(forgotten).toEqual([])
  })

  it("names as answered by v3 only addresses the MVP had", () => {
    const signedIn = new Set([...pages("(app)"), ...pages("(auth)")])
    for (const path of V3_SERVES) expect(signedIn.has(path), path).toBe(true)
  })
})
