import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { RESERVED_USERNAMES } from "@eleva/config"

/** Frozen at 0025. New reserved names ship in a later migration. */
const RESERVED_HANDLES_AT_0025 = [
  "member",
  "expert",
  "org",
  "admin",
  "settings",
  "callback",
  "logout",
  "docs",
  "pt",
  "es",
  "en",
  "br",
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
  "help",
  "support",
  "faq",
  "contact",
  "auth",
  "signin",
  "signup",
  "login",
  "dashboard",
  "account",
  "onboarding",
  "setup",
  "_next",
  "_vercel",
  "vercel",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.json",
  "icon",
  "apple-icon",
  "opengraph-image",
  "twitter-image",
  "sitemap",
  "robots",
  "manifest",
  "fonts",
  "images",
  "assets",
  "static",
  "icons",
  "academy",
  "courses",
  "team",
  "teams",
  "www",
  "mail",
  "status",
  "sessions",
  "email",
  "api",
  "app",
] as const

describe("0025 public_handles reserved trigger", () => {
  it("embeds the frozen reserved list in lowercase", () => {
    const sql = readFileSync(
      resolve(import.meta.dirname, "../migrations/main/0025_offer_model.sql"),
      "utf8"
    )
    for (const name of RESERVED_HANDLES_AT_0025) {
      expect(sql, name).toContain(`'${name.toLowerCase()}'`)
    }
  })

  it("keeps current reserved names lowercase", () => {
    for (const name of RESERVED_USERNAMES) {
      expect(name, "reserved names must be lowercase").toBe(name.toLowerCase())
    }
  })

  it("keeps the frozen 0025 list a subset of the current reserved names", () => {
    const current = new Set<string>(RESERVED_USERNAMES)
    for (const name of RESERVED_HANDLES_AT_0025) {
      expect(current.has(name), `${name} removed from RESERVED_USERNAMES`).toBe(
        true
      )
    }
  })
})
