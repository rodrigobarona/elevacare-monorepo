import { getTableName, is } from "drizzle-orm"
import { PgTable } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import * as mainSchema from "../schema/main"
import {
  RLS_CLASS_FIXTURES,
  RLS_POLICY_CLASSES,
  RLS_TABLE_ASSIGNMENTS,
  classPredicateSql,
  type RlsPolicyClass,
} from "./classes"

describe("RLS class taxonomy", () => {
  it("has exactly the seven handbook classes", () => {
    expect([...RLS_POLICY_CLASSES]).toEqual([
      "tenant-owned",
      "dual-organization",
      "owner-user-visible",
      "participant-visible",
      "staff-only",
      "public-read",
      "service-only",
    ])
  })

  it("assigns every class a fixture and fails if a class is missing", () => {
    const fixtureClasses = new Set(
      RLS_CLASS_FIXTURES.map((fixture) => fixture.class)
    )
    for (const rlsClass of RLS_POLICY_CLASSES) {
      expect(fixtureClasses.has(rlsClass)).toBe(true)
    }
    expect(RLS_CLASS_FIXTURES).toHaveLength(RLS_POLICY_CLASSES.length)
  })

  it("uses a synthetic fixture only for classes with no current table", () => {
    const classesWithTables = new Set(
      RLS_TABLE_ASSIGNMENTS.filter(
        (row) => !row.selectClass || row.selectClass === row.class
      ).map((row) => row.class)
    )
    for (const fixture of RLS_CLASS_FIXTURES) {
      if (classesWithTables.has(fixture.class)) {
        expect(fixture.synthetic).toBe(false)
        expect(fixture.table.startsWith("_rls_fixture_")).toBe(false)
      } else {
        expect(fixture.synthetic).toBe(true)
        expect(fixture.table).toBe(
          `_rls_fixture_${fixture.class.replaceAll("-", "_")}`
        )
      }
    }
  })

  it("emits a predicate for every class", () => {
    for (const rlsClass of RLS_POLICY_CLASSES) {
      const sql = classPredicateSql(rlsClass, "example")
      expect(sql.length).toBeGreaterThan(0)
    }
  })

  it("uses org_id for tenant-owned and user id for owner-visible fixtures", () => {
    expect(classPredicateSql("tenant-owned", "org_data_keys")).toContain(
      "org_id::text"
    )
    expect(
      classPredicateSql("owner-user-visible", "notification_preferences")
    ).toContain("eleva.user_id")
  })

  it("assigns an RLS class to every main schema table", () => {
    const assigned = new Set(RLS_TABLE_ASSIGNMENTS.map((row) => row.table))
    const unassigned = (Object.values(mainSchema) as unknown[])
      .filter((value): value is PgTable => is(value, PgTable))
      .map((table) => getTableName(table))
      .filter((name) => !assigned.has(name))
    expect(unassigned).toEqual([])
  })

  it("never assigns a table two classes", () => {
    const seen = new Set<string>()
    for (const row of RLS_TABLE_ASSIGNMENTS) {
      expect(seen.has(row.table)).toBe(false)
      seen.add(row.table)
    }
  })

  it("only uses classes from the taxonomy", () => {
    const allowed = new Set<RlsPolicyClass>(RLS_POLICY_CLASSES)
    for (const row of RLS_TABLE_ASSIGNMENTS) {
      expect(allowed.has(row.class)).toBe(true)
      if (row.selectClass) {
        expect(allowed.has(row.selectClass)).toBe(true)
      }
      if (row.insertClass) {
        expect(allowed.has(row.insertClass)).toBe(true)
      }
      if (row.updateClass) {
        expect(allowed.has(row.updateClass)).toBe(true)
      }
    }
  })

  it("keeps session_participants writes tenant-owned and SELECT user-visible", () => {
    const row = RLS_TABLE_ASSIGNMENTS.find(
      (item) => item.table === "session_participants"
    )
    expect(row).toEqual({
      table: "session_participants",
      class: "tenant-owned",
    })
    expect(classPredicateSql("tenant-owned", "session_participants")).toContain(
      "org_id::text"
    )
    expect(
      classPredicateSql("tenant-owned", "session_participants")
    ).not.toContain("eleva.user_id")
    expect(
      classPredicateSql("owner-user-visible", "session_participants")
    ).toContain("eleva.user_id")
    expect(
      classPredicateSql("owner-user-visible", "session_participants")
    ).not.toContain("eleva.org_id")
  })

  it("uses daily_webhook_events as the un-split staff-only fixture", () => {
    const handles = RLS_TABLE_ASSIGNMENTS.find(
      (item) => item.table === "public_handles"
    )
    expect(handles?.class).toBe("staff-only")
    expect(handles?.selectClass).toBe("public-read")
    const webhooks = RLS_TABLE_ASSIGNMENTS.find(
      (item) => item.table === "daily_webhook_events"
    )
    expect(webhooks).toEqual({
      table: "daily_webhook_events",
      class: "staff-only",
    })
    const fixture = RLS_CLASS_FIXTURES.find(
      (item) => item.class === "staff-only"
    )
    expect(fixture).toEqual({
      class: "staff-only",
      table: "daily_webhook_events",
      synthetic: false,
    })
  })

  it("models audit_events as tenant-owned SELECT and service-only INSERT", () => {
    const row = RLS_TABLE_ASSIGNMENTS.find(
      (item) => item.table === "audit_events"
    )
    expect(row?.class).toBe("service-only")
    expect(row?.selectClass).toBe("tenant-owned")
    expect(classPredicateSql("tenant-owned", "audit_events")).toBe(
      "org_id::text = current_setting('eleva.org_id', true)"
    )
    expect(classPredicateSql("service-only", "audit_events")).toBe(
      "current_setting('eleva.service', true) = 'audit_drainer'"
    )
    expect(classPredicateSql("service-only", "audit_events")).not.toContain(
      "platform_admin"
    )
    expect(classPredicateSql("service-only", "audit_events")).not.toContain(
      "stripe_webhook"
    )
    expect(classPredicateSql("service-only", "audit_events")).not.toContain(
      "eleva.org_id"
    )
    expect(classPredicateSql("service-only", "audit_outbox")).toContain(
      "stripe_webhook"
    )
  })

  it("models inbox as owner-visible with worker writes, deliveries as service-only", () => {
    const inbox = RLS_TABLE_ASSIGNMENTS.find(
      (item) => item.table === "notifications"
    )
    expect(inbox?.selectClass).toBe("owner-user-visible")
    expect(inbox?.updateClass).toBe("owner-user-visible")
    expect(inbox?.class).toBe("service-only")
    expect(inbox?.insertClass).toBeUndefined()
    expect(
      RLS_TABLE_ASSIGNMENTS.find(
        (item) => item.table === "notification_deliveries"
      )
    ).toEqual({
      table: "notification_deliveries",
      class: "service-only",
      selectClass: "tenant-owned",
    })
    const phone = RLS_TABLE_ASSIGNMENTS.find(
      (item) => item.table === "phone_verifications"
    )
    expect(phone).toEqual({
      table: "phone_verifications",
      class: "service-only",
    })
    expect(
      RLS_TABLE_ASSIGNMENTS.find((item) => item.table === "email_suppressions")
        ?.class
    ).toBe("service-only")
    expect(
      classPredicateSql("service-only", "notification_deliveries")
    ).toContain("domain_events_publisher")
    expect(
      classPredicateSql("service-only", "notification_deliveries")
    ).not.toContain("stripe_webhook")
    expect(classPredicateSql("service-only", "phone_verifications")).toContain(
      "domain_events_publisher"
    )
    expect(classPredicateSql("service-only", "notifications")).toContain(
      "domain_events_publisher"
    )
  })

  it("models DSAR and deletion as owner SELECT/INSERT and staff writes", () => {
    for (const table of ["dsar_requests", "account_deletion_requests"]) {
      const row = RLS_TABLE_ASSIGNMENTS.find((item) => item.table === table)
      expect(row?.selectClass).toBe("owner-user-visible")
      expect(row?.insertClass).toBe("owner-user-visible")
      expect(row?.class).toBe("staff-only")
    }
  })
})
