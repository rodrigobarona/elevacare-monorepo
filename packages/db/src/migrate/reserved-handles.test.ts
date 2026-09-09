import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { RESERVED_USERNAMES } from "@eleva/config"

/** Frozen at 0027. New reserved names ship in a later migration. */
const RESERVED_HANDLES_AT_0027 = [
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

function offerModelSql(): string {
  return readFileSync(
    resolve(import.meta.dirname, "../migrations/main/0027_offer_model.sql"),
    "utf8"
  )
}

function reservedHandlesFunctionBody(sql: string): string {
  const start = sql.indexOf(
    "CREATE OR REPLACE FUNCTION public.reserved_public_handles()"
  )
  expect(start).toBeGreaterThanOrEqual(0)
  const end = sql.indexOf("$$;", start)
  expect(end).toBeGreaterThan(start)
  return sql.slice(start, end)
}

describe("0027 public_handles reserved trigger", () => {
  it("embeds the frozen reserved list in reserved_public_handles()", () => {
    const body = reservedHandlesFunctionBody(offerModelSql())
    for (const name of RESERVED_HANDLES_AT_0027) {
      expect(body, name).toContain(`'${name.toLowerCase()}'`)
    }
  })

  it("keeps current reserved names lowercase", () => {
    for (const name of RESERVED_USERNAMES) {
      expect(name, "reserved names must be lowercase").toBe(name.toLowerCase())
    }
  })

  it("constrains handle shape to the 3–30 username contract", () => {
    const sql = offerModelSql()
    expect(sql).toContain('CONSTRAINT "public_handles_format"')
    expect(sql).toContain("handle::text ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'")
    expect(sql).toContain("AND handle::text NOT LIKE '%--%'")
  })

  it("keeps the frozen 0027 list a subset of the current reserved names", () => {
    const current = new Set<string>(RESERVED_USERNAMES)
    for (const name of RESERVED_HANDLES_AT_0027) {
      expect(current.has(name), `${name} removed from RESERVED_USERNAMES`).toBe(
        true
      )
    }
  })
})
