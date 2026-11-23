import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  LEGACY_PRIVATE_FIRST_SEGMENTS,
  LEGACY_PRIVATE_PAGES,
  LEGACY_PRIVATE_SECTIONS,
  rewriteLegacyPrivatePath,
} from "./legacy-private-routes"
import { rewriteParityPath } from "./public-site-parity"
import { isReserved } from "./reserved-usernames"
import { resolveDispatch } from "./dispatch"

/** The MVP's signed-in addresses that v3 serves itself, at the same path. */
const V3_SERVES = new Set([
  "/account",
  "/account/billing",
  "/account/notifications",
  "/account/security",
  "/dashboard",
  "/login",
  "/onboarding",
])

/** Staff pages: v3 sends `/admin/*` to the staff console's own host. */
const isStaffPage = (path: string) => path.startsWith("/admin/")

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
    // Pages under a word v3 still serves.
    ["/dashboard/subscription", "/dashboard"],
    ["/dashboard/widgets-kitchen-sink", "/dashboard"],
    ["/account/identity", "/dashboard"],
    ["/account/identity/callback", "/dashboard"],
    ["/account/identity/success", "/dashboard"],
    // Creating an account, and "you may not see this".
    ["/register", "/signup"],
    ["/unauthorized", "/login"],
    // As typed: a slash at the end, capitals.
    ["/appointments/", "/dashboard"],
    ["/Booking/Schedule", "/dashboard"],
  ])("%s goes to %s", (from, to) => {
    expect(rewriteLegacyPrivatePath(from)).toBe(to)
  })

  it.each([
    "/",
    "/dashboard",
    "/login",
    "/signup",
    "/onboarding",
    "/onboarding/continue",
    "/account",
    "/account/settings",
    "/account/billing",
    "/account/billing/return",
    "/account/notifications",
    "/account/security",
    "/account/workspaces/new",
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
    // A locale in front was never one of the MVP's signed-in addresses.
    "/pt/appointments",
  ])("%s only begins like one, and is left alone", (path) => {
    expect(rewriteLegacyPrivatePath(path)).toBeNull()
  })

  it("sends every one of them somewhere v3 serves", () => {
    const targets = new Set([
      ...Object.values(LEGACY_PRIVATE_SECTIONS),
      ...LEGACY_PRIVATE_PAGES.map((one) => one.to),
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
      // Not moved again, and answered by the account zone.
      expect(rewriteLegacyPrivatePath(target), target).toBeNull()
      expect(rewriteParityPath(target), target).toBeNull()
      expect(resolveDispatch(target, origins), target).toEqual({
        kind: "rewrite",
        origin: "account",
      })
    }
  })

  it("no first word of theirs can be taken as a username", () => {
    for (const word of LEGACY_PRIVATE_FIRST_SEGMENTS) {
      expect(isReserved(word), word).toBe(true)
    }
  })
})

describe("the MVP's own list of routes", () => {
  // The snapshot of the MVP kept in the repository: its signed-in pages
  // are the folders `(app)` and `(auth)` of its app directory.
  const app = join(
    import.meta.dirname,
    "../../../_context/clone-repo/eleva-care-app/src/app"
  )

  function pages(dir: string, base = ""): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isDirectory()) {
        // A group in brackets is not part of the address.
        const part = /^\(.*\)$/.test(entry.name) ? "" : `/${entry.name}`
        return pages(join(dir, entry.name), `${base}${part}`)
      }
      return entry.name === "page.tsx" ? [base || "/"] : []
    })
  }

  it("is in the repository", () => {
    expect(existsSync(join(app, "(app)"))).toBe(true)
    expect(existsSync(join(app, "(auth)"))).toBe(true)
  })

  it("has no signed-in page that is neither moved nor served by v3", () => {
    const signedIn = [
      ...pages(join(app, "(app)")),
      ...pages(join(app, "(auth)")),
    ].sort()
    expect(signedIn.length).toBeGreaterThanOrEqual(25)

    const forgotten = signedIn.filter((path) => {
      // `[id]` in a folder name is one part of an address.
      const example = path.replace(/\[[^\]]+\]/g, "example")
      return (
        rewriteLegacyPrivatePath(example) === null &&
        !V3_SERVES.has(path) &&
        !isStaffPage(path)
      )
    })
    expect(forgotten).toEqual([])
  })

  it("names as served by v3 only addresses the MVP had", () => {
    const signedIn = new Set([
      ...pages(join(app, "(app)")),
      ...pages(join(app, "(auth)")),
    ])
    for (const path of V3_SERVES) expect(signedIn.has(path), path).toBe(true)
  })
})
