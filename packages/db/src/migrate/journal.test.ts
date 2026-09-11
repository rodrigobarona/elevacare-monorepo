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
    expect(last?.tag).toBe("0031_member_privacy")
    expect(last?.statements.length).toBeGreaterThan(0)
    expect(last?.hash).toHaveLength(64)
    const offer = migrations.find((m) => m.tag === "0027_offer_model")
    const offerSql = offer?.statements.join("\n") ?? ""
    expect(offerSql).toContain("public.iso3166_alpha2_codes")
    expect(offerSql).not.toContain("SELECT 1 FROM unnest(service_countries)")
    expect(offerSql).not.toContain(
      `"country_scope_type" "country_scope_type" DEFAULT 'list'`
    )
    const finalize = migrations.find((m) => m.tag === "0028_booking_finalize")
    expect(finalize?.statements.length).toBeGreaterThan(10)
    const finalizeSql = finalize?.statements.join("\n") ?? ""
    expect(finalizeSql).toContain("btree_gist")
    expect(finalizeSql).toContain("slot_reservations_no_overlap")
    expect(finalizeSql).toContain(`SET "status" = 'expired'`)
    expect(finalizeSql).toContain("counterparty_org_id")
    expect(finalizeSql).toContain("bookings_counterparty_org_idx")
    expect(finalizeSql).toContain("bookings_price_amount_match")
    expect(finalizeSql).toContain("bookings_counterparty_read")
    expect(finalizeSql).toContain("consents_active_user_idx")
    expect(finalizeSql).toContain("ON DELETE RESTRICT")
    expect(finalizeSql).toContain("gen_random_uuid()")
    expect(finalizeSql).not.toContain("sha256(id::text")
    const funnel = migrations.find(
      (m) => m.tag === "0029_reservation_funnel_snapshot"
    )
    const funnelSql = funnel?.statements.join("\n") ?? ""
    expect(funnelSql).toContain("funnel")
    expect(funnelSql).toContain("slot_reservations_funnel_object")
    const domainEvents = migrations.find(
      (m) => m.tag === "0030_domain_events_outbox"
    )
    const domainSql = domainEvents?.statements.join("\n") ?? ""
    expect(domainSql).toContain("domain_events_outbox")
    expect(domainSql).toContain("domain_event_deliveries")
    expect(domainSql).toContain("domain_event_delivery_status")
    expect(domainSql).toContain("'processing'")
    expect(domainSql).toContain("domain_events_publisher")
    expect(domainSql).toContain("guest_activation_sent_at")
    const sql = last?.statements.join("\n") ?? ""
    expect(sql).toContain("notification_preferences")
    expect(sql).toContain("dsar_requests")
    expect(sql).toContain("account_deletion_requests")
    expect(sql).toContain("subject_pseudonym")
    expect(sql).toContain("refund_pending")
    expect(sql).toContain("'marketing'")
    expect(sql).toContain("deletion_scheduled_at")
    expect(sql).toContain("owner_user_visible")
    expect(sql).toContain("dsar_requests_owner_read")
    expect(sql).toContain("dsar_requests_admin_update")
    expect(sql).toContain("account_deletion_requests_completed_orphan")
    expect(sql).toContain("subject_kind = 'user'")
    expect(sql).toContain("receipt_url")
  })
})
