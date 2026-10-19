import type { PoolClient } from "@neondatabase/serverless"

/** Role used by ELEVA_RLS_INTEGRATION tests. Neon owners have BYPASSRLS. */
export const RLS_TEST_ROLE = "eleva_rls_test"

export async function provisionRlsTestRole(client: PoolClient): Promise<void> {
  // Concurrent GRANTs on the same catalog rows fail with "tuple concurrently
  // updated". These GRANTs also race fixture DDL, so the suite runs with
  // --no-file-parallelism (neon-branch.yml).
  await client.query("BEGIN")
  try {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('eleva_rls_test_provision'))"
    )
    await grantRlsTestRole(client)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
}

async function grantRlsTestRole(client: PoolClient): Promise<void> {
  await client.query(`
    DO $$ BEGIN
      CREATE ROLE ${RLS_TEST_ROLE} NOINHERIT NOBYPASSRLS NOSUPERUSER NOLOGIN;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN unique_violation THEN NULL;
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
