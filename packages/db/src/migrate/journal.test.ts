import { describe, expect, it } from "vitest"
import { resolve } from "node:path"
import {
  hashMigrationSql,
  isAlreadyAppliedError,
  readPreparedMigrations,
  splitMigrationSql,
} from "./journal"

describe("migration journal helpers", () => {
  it("splits on drizzle breakpoints and drops empty chunks", () => {
    expect(
      splitMigrationSql(
        "CREATE TABLE a();\n--> statement-breakpoint\n\n--> statement-breakpoint\nCREATE TABLE b();"
      )
    ).toEqual(["CREATE TABLE a();", "CREATE TABLE b();"])
  })

  it("hashes the full SQL file the same way drizzle-orm does", () => {
    expect(hashMigrationSql("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    )
  })

  it("treats duplicate-object SQLSTATEs as already applied", () => {
    expect(
      isAlreadyAppliedError({ code: "42710", message: "type already exists" })
    ).toBe(true)
    expect(
      isAlreadyAppliedError({ code: "42P01", message: "undefined table" })
    ).toBe(false)
    expect(
      isAlreadyAppliedError({ message: "relation users already exists" })
    ).toBe(true)
  })

  it("reads the main journal including the latest migration", () => {
    const folder = resolve(import.meta.dirname, "../migrations/main")
    const migrations = readPreparedMigrations(folder)
    const last = migrations.at(-1)
    expect(last?.tag).toBe("0025_offer_model")
    expect(last?.statements.length).toBeGreaterThan(10)
    expect(last?.hash).toHaveLength(64)
    const sql = last?.statements.join("\n") ?? ""
    expect(sql).toContain("public.iso3166_alpha2_codes")
    expect(sql).not.toContain("SELECT 1 FROM unnest(service_countries)")
    expect(sql).not.toContain(
      `"country_scope_type" "country_scope_type" DEFAULT 'list'`
    )
  })
})
