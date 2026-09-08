import { describe, expect, it } from "vitest"
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
      RLS_TABLE_ASSIGNMENTS.map((row) => row.class)
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

  it("uses id for organizations tenant-owned and user id for users", () => {
    expect(classPredicateSql("tenant-owned", "organizations")).toContain(
      "id::text"
    )
    expect(classPredicateSql("owner-user-visible", "users")).toContain(
      "eleva.user_id"
    )
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
    }
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
})
