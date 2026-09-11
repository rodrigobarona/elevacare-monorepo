import { randomUUID } from "node:crypto"
import { Pool, type PoolClient } from "@neondatabase/serverless"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { provisionRlsTestRole, setLocalRlsTestRole } from "./rls-test-role"
import {
  RLS_CLASS_FIXTURES,
  RLS_POLICY_CLASSES,
  RLS_TABLE_ASSIGNMENTS,
  classPredicateSql,
  type RlsClassFixture,
  type RlsPolicyClass,
} from "../rls/classes"
import {
  TENANT_TABLES,
  OWNER_USER_TABLES,
  COMPLIANCE_WORKFLOW_TABLES,
} from "../rls/policies"

const enabled = process.env.ELEVA_RLS_INTEGRATION === "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED
const auditDatabaseUrl =
  process.env.AUDIT_DATABASE_URL ?? process.env.AUDIT_DATABASE_URL_UNPOOLED

function fixtureTable(rlsClass: RlsPolicyClass): string {
  return `_rls_fixture_${rlsClass.replaceAll("-", "_")}`
}

function createTableSql(rlsClass: RlsPolicyClass, table: string): string {
  switch (rlsClass) {
    case "tenant-owned":
      return `CREATE TABLE ${table} (id uuid PRIMARY KEY, org_id uuid NOT NULL)`
    case "dual-organization":
      return `CREATE TABLE ${table} (id uuid PRIMARY KEY, org_id uuid NOT NULL, counterparty_org_id uuid NOT NULL)`
    case "owner-user-visible":
      return `CREATE TABLE ${table} (id uuid PRIMARY KEY, user_id uuid NOT NULL)`
    case "participant-visible":
      return `CREATE TABLE ${table} (id uuid PRIMARY KEY, member_user_id uuid NOT NULL)`
    case "staff-only":
      return `CREATE TABLE ${table} (id uuid PRIMARY KEY, label text NOT NULL)`
    case "public-read":
      return `CREATE TABLE ${table} (id uuid PRIMARY KEY, org_id uuid NOT NULL, published_at timestamptz)`
    case "service-only":
      return `CREATE TABLE ${table} (id uuid PRIMARY KEY, org_id uuid NOT NULL)`
    default: {
      const _exhaustive: never = rlsClass
      throw new Error(`unknown RLS class: ${_exhaustive}`)
    }
  }
}

function insertVisibleSql(
  rlsClass: RlsPolicyClass,
  table: string,
  ids: { row: string; orgA: string; orgB: string; userA: string }
): { text: string; values: unknown[] } {
  switch (rlsClass) {
    case "tenant-owned":
    case "service-only":
    case "public-read":
      return {
        text: `INSERT INTO ${table} (id, org_id) VALUES ($1, $2)`,
        values: [ids.row, ids.orgA],
      }
    case "dual-organization":
      return {
        text: `INSERT INTO ${table} (id, org_id, counterparty_org_id) VALUES ($1, $2, $3)`,
        values: [ids.row, ids.orgA, ids.orgB],
      }
    case "owner-user-visible":
      return {
        text: `INSERT INTO ${table} (id, user_id) VALUES ($1, $2)`,
        values: [ids.row, ids.userA],
      }
    case "participant-visible":
      return {
        text: `INSERT INTO ${table} (id, member_user_id) VALUES ($1, $2)`,
        values: [ids.row, ids.userA],
      }
    case "staff-only":
      return {
        text: `INSERT INTO ${table} (id, label) VALUES ($1, 'staff')`,
        values: [ids.row],
      }
    default: {
      const _exhaustive: never = rlsClass
      throw new Error(`unknown RLS class: ${_exhaustive}`)
    }
  }
}

async function withLocalSettings(
  client: PoolClient,
  settings: Record<string, string>,
  fn: () => Promise<void>
) {
  await client.query("BEGIN")
  await setLocalRlsTestRole(client)
  for (const [name, value] of Object.entries(settings)) {
    await client.query(`SELECT set_config($1, $2, true)`, [name, value])
  }
  try {
    await fn()
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
}

describe.skipIf(!enabled || !databaseUrl)("rls-classes", () => {
  const pool = new Pool({ connectionString: databaseUrl })
  const created: string[] = []

  beforeAll(async () => {
    const client = await pool.connect()
    try {
      await provisionRlsTestRole(client)
    } finally {
      client.release()
    }
  })

  afterAll(async () => {
    const client = await pool.connect()
    try {
      for (const table of created) {
        await client.query(`DROP TABLE IF EXISTS ${table}`)
      }
    } finally {
      client.release()
      await pool.end()
    }
  })

  it("has a fixture for every taxonomy class", () => {
    const covered = new Set(RLS_CLASS_FIXTURES.map((fixture) => fixture.class))
    for (const rlsClass of RLS_POLICY_CLASSES) {
      expect(covered.has(rlsClass)).toBe(true)
    }
  })

  it.each(RLS_CLASS_FIXTURES)(
    "$class ($table) positive and negative",
    { timeout: 30_000 },
    async (fixture: RlsClassFixture) => {
      const table = fixture.synthetic
        ? fixture.table
        : fixtureTable(fixture.class)
      const policy = `${table}_class_suite`
      const rowId = randomUUID()
      const orgA = randomUUID()
      const orgB = randomUUID()
      const userA = randomUUID()
      const userB = randomUUID()
      const client = await pool.connect()

      try {
        if (!table.startsWith("_rls_fixture_")) {
          throw new Error(`refusing DDL on non-fixture table: ${table}`)
        }
        await client.query(`DROP TABLE IF EXISTS ${table}`)
        await client.query(createTableSql(fixture.class, table))
        created.push(table)

        await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
        await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`)
        const predicate = classPredicateSql(fixture.class, table)
        const writePredicate =
          fixture.class === "public-read" ||
          fixture.class === "dual-organization"
            ? `org_id::text = current_setting('eleva.org_id', true)`
            : predicate
        await client.query(`DROP POLICY IF EXISTS ${policy} ON ${table}`)
        await client.query(`DROP POLICY IF EXISTS ${policy}_write ON ${table}`)
        await client.query(
          `CREATE POLICY ${policy} ON ${table} FOR SELECT USING (${predicate})`
        )
        await client.query(
          `CREATE POLICY ${policy}_write ON ${table} FOR INSERT WITH CHECK (${writePredicate})`
        )

        const insert = insertVisibleSql(fixture.class, table, {
          row: rowId,
          orgA,
          orgB,
          userA,
        })

        const seedSettings: Record<string, string> = {}
        switch (fixture.class) {
          case "tenant-owned":
          case "dual-organization":
          case "public-read":
            seedSettings["eleva.org_id"] = orgA
            break
          case "owner-user-visible":
          case "participant-visible":
            seedSettings["eleva.user_id"] = userA
            break
          case "staff-only":
            seedSettings["eleva.platform_admin"] = "true"
            break
          case "service-only":
            seedSettings["eleva.service"] = "audit_drainer"
            break
          default: {
            const _exhaustive: never = fixture.class
            throw new Error(`unhandled class: ${_exhaustive}`)
          }
        }

        await withLocalSettings(client, seedSettings, async () => {
          await client.query(insert.text, insert.values)
        })

        const expectCount = async (
          settings: Record<string, string>,
          count: number
        ) => {
          await withLocalSettings(client, settings, async () => {
            const rows = await client.query(
              `SELECT id FROM ${table} WHERE id = $1`,
              [rowId]
            )
            expect(rows.rows).toHaveLength(count)
          })
        }

        switch (fixture.class) {
          case "tenant-owned":
            await expectCount({ "eleva.org_id": orgA }, 1)
            await expectCount({ "eleva.org_id": orgB }, 0)
            break
          case "dual-organization":
            await expectCount({ "eleva.org_id": orgA }, 1)
            await expectCount({ "eleva.org_id": orgB }, 1)
            await expectCount({ "eleva.org_id": randomUUID() }, 0)
            await expect(
              withLocalSettings(client, { "eleva.org_id": orgB }, async () => {
                await client.query(
                  `INSERT INTO ${table} (id, org_id, counterparty_org_id) VALUES ($1, $2, $3)`,
                  [randomUUID(), orgA, orgB]
                )
              })
            ).rejects.toThrow()
            break
          case "owner-user-visible":
          case "participant-visible":
            await expectCount({ "eleva.user_id": userA }, 1)
            await expectCount({ "eleva.user_id": userB }, 0)
            break
          case "staff-only":
            await expectCount({ "eleva.platform_admin": "true" }, 1)
            await expectCount({ "eleva.platform_admin": "false" }, 0)
            break
          case "public-read":
            await expectCount({}, 1)
            await expectCount({ "eleva.org_id": orgB }, 1)
            await expect(
              withLocalSettings(client, { "eleva.org_id": orgB }, async () => {
                await client.query(
                  `INSERT INTO ${table} (id, org_id) VALUES ($1, $2)`,
                  [randomUUID(), orgA]
                )
              })
            ).rejects.toThrow()
            break
          case "service-only":
            await expectCount({ "eleva.platform_admin": "true" }, 1)
            await expectCount({ "eleva.service": "audit_drainer" }, 1)
            await expectCount({ "eleva.service": "other" }, 0)
            break
          default: {
            const _exhaustive: never = fixture.class
            throw new Error(`unhandled class: ${_exhaustive}`)
          }
        }

        if (!fixture.synthetic) {
          const found = await client.query(
            `SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = $1`,
            [fixture.table]
          )
          expect(found.rowCount).toBeGreaterThan(0)
        }
      } finally {
        client.release()
      }
    }
  )

  it("audit_events split: tenant SELECT and service-only INSERT", async () => {
    const table = "_rls_fixture_audit_events_split"
    const rowId = randomUUID()
    const orgA = randomUUID()
    const orgB = randomUUID()
    const client = await pool.connect()

    try {
      await client.query(`DROP TABLE IF EXISTS ${table}`)
      await client.query(
        `CREATE TABLE ${table} (id uuid PRIMARY KEY, org_id uuid NOT NULL)`
      )
      created.push(table)
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
      await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`)
      const selectPred = classPredicateSql("tenant-owned", table)
      const insertPred = classPredicateSql("service-only", table)
      await client.query(
        `CREATE POLICY ${table}_read ON ${table} FOR SELECT USING (${selectPred})`
      )
      await client.query(
        `CREATE POLICY ${table}_write ON ${table} FOR INSERT WITH CHECK (${insertPred})`
      )

      await withLocalSettings(
        client,
        { "eleva.service": "audit_drainer" },
        async () => {
          await client.query(
            `INSERT INTO ${table} (id, org_id) VALUES ($1, $2)`,
            [rowId, orgA]
          )
        }
      )

      await expect(
        withLocalSettings(client, { "eleva.org_id": orgA }, async () => {
          await client.query(
            `INSERT INTO ${table} (id, org_id) VALUES ($1, $2)`,
            [randomUUID(), orgA]
          )
        })
      ).rejects.toThrow()

      await expect(
        withLocalSettings(
          client,
          { "eleva.platform_admin": "true" },
          async () => {
            await client.query(
              `INSERT INTO ${table} (id, org_id) VALUES ($1, $2)`,
              [randomUUID(), orgA]
            )
          }
        )
      ).rejects.toThrow()

      await withLocalSettings(client, { "eleva.org_id": orgA }, async () => {
        const rows = await client.query(
          `SELECT id FROM ${table} WHERE id = $1`,
          [rowId]
        )
        expect(rows.rows).toHaveLength(1)
      })
      await withLocalSettings(client, { "eleva.org_id": orgB }, async () => {
        const rows = await client.query(
          `SELECT id FROM ${table} WHERE id = $1`,
          [rowId]
        )
        expect(rows.rows).toHaveLength(0)
      })
    } finally {
      client.release()
    }
  })

  it(
    "installed policies exist on assigned main-db tables",
    { timeout: 30_000 },
    async () => {
      const client = await pool.connect()
      try {
        const managed = new Set<string>([
          ...TENANT_TABLES,
          ...OWNER_USER_TABLES,
          ...COMPLIANCE_WORKFLOW_TABLES,
        ])
        for (const row of RLS_TABLE_ASSIGNMENTS) {
          if (row.table === "audit_events") {
            continue
          }

          const exists = await client.query(
            `SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1`,
            [row.table]
          )
          expect(exists.rowCount, row.table).toBeGreaterThan(0)

          if (!managed.has(row.table)) {
            continue
          }

          const rel = await client.query<{
            relrowsecurity: boolean
            relforcerowsecurity: boolean
          }>(
            `SELECT relrowsecurity, relforcerowsecurity
           FROM pg_class
           WHERE relname = $1 AND relkind = 'r'`,
            [row.table]
          )
          expect(rel.rows[0]?.relrowsecurity, row.table).toBe(true)
          expect(rel.rows[0]?.relforcerowsecurity, row.table).toBe(true)

          const policies = await client.query<{
            using: string | null
            with_check: string | null
          }>(
            `SELECT pg_get_expr(p.polqual, p.polrelid) AS using,
                  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
           FROM pg_policy p
           JOIN pg_class c ON c.oid = p.polrelid
           WHERE c.relname = $1`,
            [row.table]
          )
          expect(policies.rowCount, `${row.table} policies`).toBeGreaterThan(0)

          const combined = policies.rows
            .flatMap((policy) => [policy.using, policy.with_check])
            .filter(Boolean)
            .join(" ")
          const ownerUserTables = new Set<string>(OWNER_USER_TABLES)
          const complianceTables = new Set<string>(COMPLIANCE_WORKFLOW_TABLES)
          if (ownerUserTables.has(row.table)) {
            expect(combined, row.table).toContain("eleva.user_id")
            expect(combined, row.table).toContain("user_id")
            expect(combined, row.table).not.toContain("eleva.org_id")
          } else if (complianceTables.has(row.table)) {
            expect(combined, row.table).toContain("eleva.user_id")
            expect(combined, row.table).toContain("eleva.platform_admin")
            expect(combined, row.table).not.toContain("eleva.org_id")
          } else {
            expect(combined, row.table).toContain("eleva.org_id")
            expect(combined).toContain("org_id")
          }
        }
      } finally {
        client.release()
      }
    }
  )

  it(
    "installed audit_events policies enforce tenant SELECT and drainer INSERT",
    { timeout: 30_000 },
    async () => {
      expect(auditDatabaseUrl, "AUDIT_DATABASE_URL").toBeTruthy()
      const auditPool = new Pool({ connectionString: auditDatabaseUrl })
      const client = await auditPool.connect()
      await provisionRlsTestRole(client)
      const orgA = randomUUID()
      const orgB = randomUUID()
      const auditId = randomUUID()
      const insertSql = `INSERT INTO audit_events
      (audit_id, org_id, action, entity, payload)
      VALUES ($1, $2, 'created', 'organization', '{}'::jsonb)`

      try {
        const rel = await client.query<{
          relrowsecurity: boolean
          relforcerowsecurity: boolean
        }>(
          `SELECT relrowsecurity, relforcerowsecurity
         FROM pg_class
         WHERE relname = 'audit_events' AND relkind = 'r'`
        )
        expect(rel.rows[0]?.relrowsecurity).toBe(true)
        expect(rel.rows[0]?.relforcerowsecurity).toBe(true)

        const policies = await client.query<{
          polname: string
          polcmd: string
          using: string | null
          with_check: string | null
        }>(
          `SELECT p.polname,
                p.polcmd,
                pg_get_expr(p.polqual, p.polrelid) AS using,
                pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
         FROM pg_policy p
         JOIN pg_class c ON c.oid = p.polrelid
         WHERE c.relname = 'audit_events'`
        )
        expect(policies.rowCount).toBeGreaterThanOrEqual(2)
        const selectPolicy = policies.rows.find((row) => row.polcmd === "r")
        const insertPolicy = policies.rows.find((row) => row.polcmd === "a")
        expect(selectPolicy?.using).toContain("eleva.org_id")
        expect(selectPolicy?.using).toContain("platform_admin")
        expect(insertPolicy?.with_check).toContain("audit_drainer")
        expect(insertPolicy?.with_check).not.toContain("platform_admin")

        await expect(
          withLocalSettings(
            client,
            { "eleva.platform_admin": "true" },
            async () => {
              await client.query(insertSql, [randomUUID(), orgA])
            }
          )
        ).rejects.toThrow()

        await withLocalSettings(
          client,
          { "eleva.service": "audit_drainer" },
          async () => {
            await client.query(insertSql, [auditId, orgA])
          }
        )

        await withLocalSettings(client, { "eleva.org_id": orgA }, async () => {
          const rows = await client.query(
            `SELECT audit_id FROM audit_events WHERE audit_id = $1`,
            [auditId]
          )
          expect(rows.rows).toHaveLength(1)
        })
        await withLocalSettings(client, { "eleva.org_id": orgB }, async () => {
          const rows = await client.query(
            `SELECT audit_id FROM audit_events WHERE audit_id = $1`,
            [auditId]
          )
          expect(rows.rows).toHaveLength(0)
        })
        await withLocalSettings(
          client,
          { "eleva.platform_admin": "true" },
          async () => {
            const rows = await client.query(
              `SELECT audit_id FROM audit_events WHERE audit_id = $1`,
              [auditId]
            )
            expect(rows.rows).toHaveLength(1)
          }
        )
      } finally {
        client.release()
        await auditPool.end()
      }
    }
  )
})
