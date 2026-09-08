/**
 * Backfill / verify auth.user, auth.organization, and auth.member from
 * main.users, main.organizations, and main.memberships.
 *
 *   pnpm --filter=@eleva/db db:backfill:auth-identity
 *   pnpm --filter=@eleva/db db:backfill:auth-identity -- --verify
 */
import { neon } from "@neondatabase/serverless"

const VERIFY = process.argv.includes("--verify")
const REPORT_CAP = 50

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required")
  const sql = neon(url)

  if (!VERIFY) {
    await sql`
      INSERT INTO auth.user (
        id, name, email, email_verified, image, created_at, updated_at
      )
      SELECT
        u.id,
        'Legacy Member',
        u.workos_user_id || '@legacy.eleva.care',
        true,
        u.avatar_url,
        u.created_at,
        u.updated_at
      FROM users u
      ON CONFLICT (id) DO NOTHING
    `
    await sql`
      INSERT INTO auth.organization (id, name, slug, created_at, type)
      SELECT
        o.id,
        COALESCE(o.slug, 'organization'),
        COALESCE(NULLIF(o.slug, ''), 'org-' || replace(o.id::text, '-', '')),
        o.created_at,
        o.type::text
      FROM organizations o
      ON CONFLICT (id) DO NOTHING
    `
    await sql`
      INSERT INTO auth.member (id, organization_id, user_id, role, created_at)
      SELECT
        m.id,
        m.org_id,
        m.user_id,
        CASE WHEN m.workos_role = 'admin' THEN 'owner' ELSE 'member' END,
        m.created_at
      FROM memberships m
      ON CONFLICT (id) DO NOTHING
    `
  }

  const counts = await sql`
    SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM auth.user) AS auth_users,
      (SELECT count(*)::int FROM organizations) AS organizations,
      (SELECT count(*)::int FROM auth.organization) AS auth_organizations,
      (SELECT count(*)::int FROM memberships) AS memberships,
      (SELECT count(*)::int FROM auth.member) AS auth_members
  `
  const row = counts[0] as Record<string, number>
  console.log("parity counts", row)

  const missingUsers = await sql`
    SELECT u.id
    FROM users u
    LEFT JOIN auth.user a ON a.id = u.id
    WHERE a.id IS NULL
    LIMIT ${REPORT_CAP}
  `
  const missingOrgs = await sql`
    SELECT o.id
    FROM organizations o
    LEFT JOIN auth.organization a ON a.id = o.id
    WHERE a.id IS NULL
    LIMIT ${REPORT_CAP}
  `
  const missingMembers = await sql`
    SELECT m.id, m.user_id, m.org_id, m.workos_role
    FROM memberships m
    LEFT JOIN auth.member a ON a.id = m.id
    WHERE a.id IS NULL
      OR a.user_id IS DISTINCT FROM m.user_id
      OR a.organization_id IS DISTINCT FROM m.org_id
      OR a.role IS DISTINCT FROM CASE
        WHEN m.workos_role = 'admin' THEN 'owner' ELSE 'member'
      END
    LIMIT ${REPORT_CAP}
  `
  const orphanOrgs = await sql`
    SELECT c.org_id
    FROM billing_customers c
    LEFT JOIN auth.organization a ON a.id = c.org_id
    WHERE a.id IS NULL
    LIMIT ${REPORT_CAP}
  `

  const failures = [
    missingUsers.length > 0
      ? `missing auth.user: ${missingUsers.length}`
      : null,
    missingOrgs.length > 0
      ? `missing auth.organization: ${missingOrgs.length}`
      : null,
    missingMembers.length > 0
      ? `missing/mismatched auth.member: ${missingMembers.length}`
      : null,
    orphanOrgs.length > 0
      ? `billing_customers orphans: ${orphanOrgs.length}`
      : null,
    row.users > row.auth_users ? "user count mismatch" : null,
    row.organizations > row.auth_organizations
      ? "organization count mismatch"
      : null,
    row.memberships > row.auth_members ? "membership count mismatch" : null,
  ].filter(Boolean)

  if (missingUsers.length) console.error("missing users", missingUsers)
  if (missingOrgs.length) console.error("missing orgs", missingOrgs)
  if (missingMembers.length) console.error("member mismatches", missingMembers)
  if (orphanOrgs.length) console.error("org orphans", orphanOrgs)

  if (failures.length > 0) {
    console.error("verify failed:", failures.join("; "))
    process.exit(1)
  }

  console.log("verify ok")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
