import { describe, expect, it } from "vitest"
import {
  buildAllRlsSql,
  buildAuditRlsStatements,
  buildMainRlsStatements,
  TENANT_TABLES,
} from "./policies"

describe("buildMainRlsStatements", () => {
  const stmts = buildMainRlsStatements()

  it("emits ENABLE + FORCE + DROP + CREATE for every tenant table", () => {
    for (const table of TENANT_TABLES) {
      expect(stmts).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`)
      expect(stmts).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`)
      expect(stmts).toContain(
        `DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table};`
      )
      expect(
        stmts.some((s) =>
          s.startsWith(`CREATE POLICY ${table}_tenant_isolation`)
        )
      ).toBe(true)
    }
  })

  it("keys the predicate on current_setting eleva.org_id", () => {
    for (const stmt of stmts.filter((s) => s.startsWith("CREATE POLICY"))) {
      expect(stmt).toContain(`current_setting('eleva.org_id', true)`)
    }
  })

  it("is idempotent (all DROPs are IF EXISTS)", () => {
    const drops = stmts.filter((s) => s.startsWith("DROP POLICY"))
    expect(drops.length).toBeGreaterThan(0)
    expect(drops.every((s) => s.includes("IF EXISTS"))).toBe(true)
  })

  it("organizations policy uses id (self) not org_id", () => {
    const orgPolicy = stmts.find((s) =>
      s.startsWith("CREATE POLICY organizations_tenant_isolation")
    )
    expect(orgPolicy).toBeDefined()
    expect(orgPolicy).toContain(
      `id::text = current_setting('eleva.org_id', true)`
    )
  })
})

describe("buildAuditRlsStatements", () => {
  const stmts = buildAuditRlsStatements()

  it("enables and forces RLS on audit_events", () => {
    expect(stmts).toContain(
      "ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;"
    )
    expect(stmts).toContain(
      "ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;"
    )
  })

  it("separate SELECT and INSERT policies (no UPDATE/DELETE)", () => {
    expect(stmts.some((s) => s.includes("FOR SELECT"))).toBe(true)
    expect(stmts.some((s) => s.includes("FOR INSERT"))).toBe(true)
    expect(stmts.some((s) => s.includes("FOR UPDATE"))).toBe(false)
    expect(stmts.some((s) => s.includes("FOR DELETE"))).toBe(false)
  })

  it("platform admins bypass via eleva.platform_admin setting", () => {
    const selectPolicy = stmts.find((s) => s.includes("FOR SELECT"))
    expect(selectPolicy).toContain(
      "current_setting('eleva.platform_admin', true) = 'true'"
    )
  })
})

describe("buildAllRlsSql", () => {
  it("joins main + audit with commented headers", () => {
    const sql = buildAllRlsSql()
    expect(sql).toContain("-- Main DB RLS")
    expect(sql).toContain("-- Audit DB RLS")
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY")
  })
})
