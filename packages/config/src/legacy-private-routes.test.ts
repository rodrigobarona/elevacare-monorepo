import { existsSync, readdirSync, readFileSync } from "node:fs"
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
const read = (file: string) => readFileSync(file, "utf8")

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

/** The first words of the public site's own pages, read from its folders. */
const PUBLIC_SITE = readdirSync(join(REPOSITORY, "apps/web/src/app/[locale]"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory() && /^[a-z]/.test(entry.name))
  .map((entry) => entry.name)

/** Every first word the gateway gives to an app or to the public site. */
const LIVE_FIRST_WORDS = new Set<string>([
  ...APP_REWRITE_PATHS,
  ...WEB_MARKETING_PATHS,
  ...WORKSPACE_NAMESPACES,
  ...PUBLIC_SITE,
  ...locales,
  "docs",
  "admin",
])

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
    ["/sign-out", "/logout"],
    ["/sign-up", "/signup"],
    ["/events", "/dashboard"],
    ["/events/evt_1", "/dashboard"],
    ["/settings/calendar", "/dashboard"],
    ["/settings/integrations", "/dashboard"],
    ["/appointment/123", "/dashboard"],
    ["/receipt/123", "/dashboard"],
    ["/receipts/123", "/dashboard"],
    ["/payment/voucher/123", "/dashboard"],
    ["/meet/apt_conf_123", "/dashboard"],
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
    "/eventsclub",
    "/payments",
    "/meeting",
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
    for (const word of Object.keys(LEGACY_PRIVATE_SECTIONS)) {
      expect(LIVE_FIRST_WORDS.has(word), word).toBe(false)
    }
    // And the words whose pages are moved one by one are the account
    // app's: nothing else is touched under any other first word.
    for (const one of LEGACY_PRIVATE_PAGES) {
      const first = ("below" in one ? one.below : one.from).split("/")[1]
      expect(["dashboard", "account"], first).toContain(first)
    }
  })

  it("is keyed by words as the rule reads them", () => {
    // The rule lowers the address before it looks a word up, so a key
    // written any other way would never match and would still reserve.
    for (const word of Object.keys(LEGACY_PRIVATE_SECTIONS)) {
      expect(word, word).toMatch(/^[a-z][a-z0-9-]*$/)
    }
    for (const one of LEGACY_PRIVATE_PAGES) {
      const path = "below" in one ? one.below : one.from
      expect(path, path).toMatch(/^(\/[a-z][a-z0-9-]*)+$/)
    }
  })

  it("no first word of theirs can be taken as a username", () => {
    for (const word of Object.keys(LEGACY_PRIVATE_SECTIONS)) {
      expect(isReserved(word), word).toBe(true)
    }
    expect(isReserved("dashboard")).toBe(true)
    expect(isReserved("account")).toBe(true)
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

describe("the addresses the MVP's own code wrote", () => {
  // Its pages are not all of it: its emails, notices and links wrote
  // addresses too, some with no page behind them. Every quoted address in
  // its code is read here, so one that is found later fails this test and
  // not a person with an old email.
  const source = join(REPOSITORY, "_context/clone-repo/eleva-care-app/src")

  function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(join(dir, entry.name))
        : /\.tsx?$/.test(entry.name)
          ? [join(dir, entry.name)]
          : []
    )
  }

  /**
   * The path of each address that begins a quoted text: `'/x/y'`,
   * `"https://eleva.care/x"`, `` `/x/${id}` ``, and `` `${BASE_URL}/x` ``,
   * which is how its emails wrote a whole address.
   */
  function written(text: string): string[] {
    const quoted =
      /['"`](?:https?:\/\/(?:www\.)?eleva\.care|\$\{[^}'"`]*\})?(\/[a-z][^'"`\s]*)['"`]?/g
    return [...text.matchAll(quoted)].flatMap((match) => {
      const path = match[1]!
        .split(/[?#]/)[0]!
        // A part filled in when the address is made.
        .replace(/\$\{.*$/, "example")
        .replace(/\/$/, "")
      // A file (`/img/share.png`) is not a page.
      return path.includes(".") ? [] : [path]
    })
  }

  /**
   * First words that are not a signed-in address of the MVP's site, each
   * with what it is.
   */
  const NOT_ONE: Record<string, string> = {
    api: "its API routes: not pages",
    auth: "a word its analytics looks for inside an address",
    monitoring: "the route its error reports were sent through",
    emails: "files of its own email templates",
    data: "a folder its robots file names, with no page",
    bookings: "a folder its robots file names, with no page",
    foo: "an example in a comment",
    partner: "in its permission list, with no page behind it",
    providers: "sample data in the preview of an email",
    // Written after `/account/billing` in its notices; moved under it.
    multibanco: "the end of an address under /account/billing",
    refunds: "the end of an address under /account/billing",
    retry: "the end of an address under /account/billing",
    // Written after another service's address.
    fail: "the end of its uptime monitor's address",
    v1: "the API of its notification service",
    // Public addresses. The public pages are Phase 4's
    // (`public-site-parity`); these two are not in it.
    services: "public pages of its footer",
    "become-partner": "a public page",
  }

  const all = [...new Set(files(source).flatMap((file) => written(read(file))))]

  it("reads a few hundred files and finds the ones we know", () => {
    expect(files(source).length).toBeGreaterThan(300)
    for (const known of [
      "/account/security/password",
      "/events/example",
      "/register",
      "/unauthorized",
      "/sign-in",
    ]) {
      expect(all, known).toContain(known)
    }
  })

  it("reads an address written after the site's own address", () => {
    expect(written("`${DEFAULT_BASE_URL}/unsubscribe`")).toEqual([
      "/unsubscribe",
    ])
    expect(
      written("`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/x?a=1`")
    ).toEqual(["/dashboard/x"])
    expect(written("'https://eleva.care/receipts/123'")).toEqual([
      "/receipts/123",
    ])
    expect(written("`/events/${eventId}`")).toEqual(["/events/example"])
    expect(written("'/img/share.png'")).toEqual([])
    for (const known of ["/unsubscribe", "/dashboard/subscription"]) {
      expect(all, known).toContain(known)
    }
  })

  it("has none that is neither moved, nor answered by v3, nor named as something else", () => {
    const forgotten = all.filter((path) => {
      const first = path.split("/")[1]!
      if (!/^[a-z][a-z0-9-]*$/.test(first)) return false
      if (rewriteLegacyPrivatePath(path) !== null) return false
      if (rewriteParityPath(path) !== null) return false
      // Under the account app's words, the page itself must be there.
      if (ACCOUNT_APP.some((address) => address.split("/")[1] === first)) {
        return !serves(ACCOUNT_APP, path)
      }
      return !LIVE_FIRST_WORDS.has(first) && !Object.hasOwn(NOT_ONE, first)
    })
    expect(forgotten.sort()).toEqual([])
  })

  it("names as something else only words the code has, and none it moves", () => {
    const firsts = new Set(all.map((path) => path.split("/")[1]))
    for (const word of Object.keys(NOT_ONE)) {
      expect(firsts.has(word), word).toBe(true)
      expect(rewriteLegacyPrivatePath(`/${word}`), word).toBeNull()
    }
  })
})
