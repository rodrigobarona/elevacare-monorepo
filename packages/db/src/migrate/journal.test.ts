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
    expect(last?.tag).toBe("0028_booking_finalize")
    expect(last?.statements.length).toBeGreaterThan(10)
    expect(last?.hash).toHaveLength(64)
    const offer = migrations.find((m) => m.tag === "0027_offer_model")
    const offerSql = offer?.statements.join("\n") ?? ""
    expect(offerSql).toContain("public.iso3166_alpha2_codes")
    expect(offerSql).not.toContain("SELECT 1 FROM unnest(service_countries)")
    expect(offerSql).not.toContain(
      `"country_scope_type" "country_scope_type" DEFAULT 'list'`
    )
    const sql = last?.statements.join("\n") ?? ""
    expect(sql).toContain("btree_gist")
    expect(sql).toContain("slot_reservations_no_overlap")
    expect(sql).toContain(`SET "status" = 'expired'`)
    expect(sql).toContain("counterparty_org_id")
    expect(sql).toContain("bookings_counterparty_org_idx")
    expect(sql).toContain("bookings_price_amount_match")
    expect(sql).toContain("bookings_counterparty_read")
    expect(sql).toContain("consents_active_user_idx")
    expect(sql).toContain("ON DELETE RESTRICT")
    expect(sql).toContain("gen_random_uuid()")
    expect(sql).not.toContain("sha256(id::text")
  })
})
