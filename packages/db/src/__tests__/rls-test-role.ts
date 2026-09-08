import type { PoolClient } from "@neondatabase/serverless"

/** Role used by ELEVA_RLS_INTEGRATION tests. Neon owners have BYPASSRLS. */
export const RLS_TEST_ROLE = "eleva_rls_test"

export async function provisionRlsTestRole(client: PoolClient): Promise<void> {
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RLS_TEST_ROLE}') THEN
        CREATE ROLE ${RLS_TEST_ROLE} NOINHERIT NOBYPASSRLS NOSUPERUSER NOLOGIN;
      END IF;
    END $$;
  `)
  await client.query(`GRANT ${RLS_TEST_ROLE} TO CURRENT_USER`)
  await client.query(`GRANT USAGE ON SCHEMA public TO ${RLS_TEST_ROLE}`)
  await client.query(
    `GRANT ALL ON ALL TABLES IN SCHEMA public TO ${RLS_TEST_ROLE}`
  )
  await client.query(
    `GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${RLS_TEST_ROLE}`
  )
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${RLS_TEST_ROLE}`
  )
}

export async function setLocalRlsTestRole(client: PoolClient): Promise<void> {
  await client.query(`SET LOCAL ROLE ${RLS_TEST_ROLE}`)
}
