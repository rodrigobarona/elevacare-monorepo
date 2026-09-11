import { describe, expect, it } from "vitest"
import {
  buildAllRlsSql,
  buildAuditRlsStatements,
  buildMainRlsStatements,
  TENANT_TABLES,
  OWNER_USER_TABLES,
  COMPLIANCE_WORKFLOW_TABLES,
  ADMIN_BYPASS_TABLES,
} from "./policies"

describe("buildMainRlsStatements", () => {
  const stmts = buildMainRlsStatements()

  it("emits ENABLE + FORCE for every tenant table", () => {
    for (const table of TENANT_TABLES) {
      expect(stmts).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`)
      expect(stmts).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`)
    }
  })

  it("drops then creates policy for every tenant table", () => {
    for (const table of TENANT_TABLES) {
      expect(stmts).toContain(
        `DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table};`
      )
      expect(
        stmts.some(
          (s) =>
            s.startsWith(`CREATE POLICY ${table}_tenant_isolation`) &&
            s.includes("USING") &&
            s.includes("WITH CHECK")
        )
      ).toBe(true)
    }
  })

  it("keeps dual-organization writes on org_id and SELECT on counterparty", () => {
    const write = stmts.find((s) =>
      s.startsWith("CREATE POLICY bookings_tenant_isolation")
    )
    const read = stmts.find((s) =>
      s.startsWith("CREATE POLICY bookings_counterparty_read")
    )
    expect(write).toContain(
      "org_id::text = current_setting('eleva.org_id', true)"
    )
    expect(write).not.toContain("counterparty_org_id")
    expect(read).toContain("FOR SELECT")
    expect(read).toContain(
      "counterparty_org_id::text = current_setting('eleva.org_id', true)"
    )
  })

  it("omits the counterparty predicate for non-dual tables", () => {
    for (const table of TENANT_TABLES.filter((t) => t !== "bookings")) {
      const policy = stmts.find((s) =>
        s.startsWith(`CREATE POLICY ${table}_tenant_isolation`)
      )
      expect(policy).not.toContain("counterparty_org_id")
    }
  })

  it("includes platform_admin bypass for expert_profiles", () => {
    const policy = stmts.find((s) =>
      s.startsWith("CREATE POLICY expert_profiles_tenant_isolation")
    )
    expect(policy).toContain(
      "org_id::text = current_setting('eleva.org_id', true)"
    )
    expect(policy).toContain(
      "current_setting('eleva.platform_admin', true) = 'true'"
    )
  })

  it("does NOT include platform_admin bypass for non-bypass tables", () => {
    const nonBypassTables = TENANT_TABLES.filter(
      (t) => !ADMIN_BYPASS_TABLES.has(t)
    )
    for (const table of nonBypassTables) {
      const policy = stmts.find((s) =>
        s.startsWith(`CREATE POLICY ${table}_tenant_isolation`)
      )
      expect(policy).not.toContain("eleva.platform_admin")
    }
  })
})

describe("owner-user-visible RLS", () => {
  const stmts = buildMainRlsStatements()

  it("emits ENABLE + FORCE and an owner-user policy for every owner-user table", () => {
    for (const table of OWNER_USER_TABLES) {
      expect(stmts).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`)
      expect(stmts).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`)
      expect(stmts).toContain(
        `DROP POLICY IF EXISTS ${table}_owner_user_visible ON ${table};`
      )
      const policy = stmts.find((s) =>
        s.startsWith(`CREATE POLICY ${table}_owner_user_visible`)
      )
      expect(policy).toContain(
        "user_id::text = current_setting('eleva.user_id', true)"
      )
      expect(policy).toContain("USING")
      expect(policy).toContain("WITH CHECK")
      expect(policy).not.toContain("eleva.org_id")
    }
  })
})

describe("compliance workflow RLS", () => {
  const stmts = buildMainRlsStatements()

  it("splits owner read/insert from admin update/delete", () => {
    for (const table of COMPLIANCE_WORKFLOW_TABLES) {
      const read = stmts.find((s) =>
        s.startsWith(`CREATE POLICY ${table}_owner_read`)
      )
      const insert = stmts.find((s) =>
        s.startsWith(`CREATE POLICY ${table}_owner_insert`)
      )
      const update = stmts.find((s) =>
        s.startsWith(`CREATE POLICY ${table}_admin_update`)
      )
      const del = stmts.find((s) =>
        s.startsWith(`CREATE POLICY ${table}_admin_delete`)
      )
      expect(read).toContain("FOR SELECT")
      expect(read).toContain("eleva.user_id")
      expect(read).toContain("eleva.platform_admin")
      expect(insert).toContain("FOR INSERT")
      expect(insert).toContain("status = 'pending' AND (")
      expect(insert).not.toContain("AND status = 'pending') OR")
      expect(update).toContain("FOR UPDATE")
      expect(update).toContain("eleva.platform_admin")
      expect(update).not.toContain("eleva.user_id")
      expect(del).toContain("FOR DELETE")
      expect(del).toContain("eleva.platform_admin")
    }
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

  it("drainer insert is audit_drainer only", () => {
    const insertPolicy = stmts.find((s) => s.includes("FOR INSERT"))
    expect(insertPolicy).toContain("eleva.service")
    expect(insertPolicy).toContain("audit_drainer")
    expect(insertPolicy).not.toContain("platform_admin")
    expect(insertPolicy).not.toMatch(/WITH CHECK \(true\)/)
  })
})

describe("buildAllRlsSql", () => {
  it("joins main + audit with commented headers", () => {
    const sql = buildAllRlsSql()
    expect(sql).toContain("-- Main DB RLS")
    expect(sql).toContain("-- Audit DB RLS")
    expect(sql).toContain("FORCE ROW LEVEL SECURITY")
  })
})
