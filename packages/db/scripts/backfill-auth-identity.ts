/**
 * Confirms leftover identity tables are gone after migration 0024.
 *
 *   pnpm --filter=@eleva/db db:backfill:auth-identity -- --verify
 */
import { neon } from "@neondatabase/serverless"

async function main() {
  if (!process.argv.includes("--verify")) {
    console.error(
      "Legacy identity backfill is closed. Re-run with --verify after 0024."
    )
    process.exit(1)
  }

  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required")
  const sql = neon(url)

  const leftover = await sql`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN (
        'users',
        'organizations',
        'memberships',
        'roles',
        'permissions'
      )
    ORDER BY c.relname
  `

  if (leftover.length > 0) {
    console.error(
      "legacy identity tables still present:",
      leftover.map((row) => row.relname)
    )
    process.exit(1)
  }

  const counts = await sql`
    SELECT
      (SELECT count(*)::int FROM auth.user) AS auth_users,
      (SELECT count(*)::int FROM auth.organization) AS auth_organizations,
      (SELECT count(*)::int FROM auth.member) AS auth_members
  `
  console.log("auth identity counts", counts[0])
  console.log("verify ok: leftover identity tables are gone")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
