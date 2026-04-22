/**
 * Neon RLS Client - Standard Approach (AuthKit)
 *
 * This approach uses SET LOCAL to set user context for RLS policies.
 * More portable and production-ready than JWT-based approaches.
 *
 * Usage:
 *   const db = await getOrgScopedDb();
 *   const events = await db.select().from(EventsTable);
 *   // RLS automatically filters to user's org
 */
import { db } from '@/drizzle/db';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { sql } from 'drizzle-orm';

/**
 * Set RLS context for the current database connection
 *
 * This must be called within a transaction to ensure the context
 * is isolated per-request.
 *
 * @example
 * ```typescript
 * await db.transaction(async (tx) => {
 *   await setRLSContext(tx, userId, orgId);
 *   const events = await tx.select().from(EventsTable);
 *   // RLS automatically applied
 * });
 * ```
 */
export async function setRLSContext(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  orgId: string,
): Promise<void> {
  await transaction.execute(sql`SET LOCAL app.user_id = ${userId}`);
  await transaction.execute(sql`SET LOCAL app.org_id = ${orgId}`);
}

/**
 * Clear RLS context (optional - auto-cleared after transaction)
 */
export async function clearRLSContext(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<void> {
  await transaction.execute(sql`SET LOCAL app.user_id = NULL`);
  await transaction.execute(sql`SET LOCAL app.org_id = NULL`);
}

/**
 * Get database connection with RLS context automatically set
 *
 * This is a convenience wrapper that:
 * 1. Gets the current user session
 * 2. Starts a transaction
 * 3. Sets RLS context
 * 4. Returns the transaction for queries
 *
 * @returns Database transaction with RLS context set
 *
 * @example
 * ```typescript
 * const db = await getOrgScopedDb();
 * const events = await db.select().from(EventsTable);
 * // RLS automatically filters to user's org
 * ```
 *
 * @throws {Error} If user is not authenticated
 */
export async function getOrgScopedDb() {
  const { user, organizationId } = await withAuth({ ensureSignedIn: true });

  // Start a transaction (required for SET LOCAL)
  return await db.transaction(async (tx) => {
    // Set RLS context
    await setRLSContext(tx, user.id, organizationId!);

    // Return transaction for queries
    return tx;
  });
}

/**
 * Execute a function with RLS context
 *
 * Use this when you need more control over the transaction.
 *
 * @example
 * ```typescript
 * const result = await withRLSContext(async (tx) => {
 *   const events = await tx.select().from(EventsTable);
 *   const meetings = await tx.select().from(MeetingsTable);
 *   return { events, meetings };
 * });
 * ```
 */
export async function withRLSContext<T>(
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  const { user, organizationId } = await withAuth({ ensureSignedIn: true });

  return await db.transaction(async (tx) => {
    await setRLSContext(tx, user.id, organizationId!);
    return await fn(tx);
  });
}

/**
 * Get admin database connection (bypasses RLS)
 *
 * ⚠️ USE WITH EXTREME CAUTION
 *
 * This should ONLY be used for:
 * - System operations (cron jobs, webhooks)
 * - Admin-level queries with explicit authorization
 * - Data migrations
 *
 * @example
 * ```typescript
 * // In a webhook handler
 * const adminDb = getAdminDb();
 * await adminDb.insert(OrganizationsTable).values(...);
 * ```
 */
export function getAdminDb() {
  // Return regular db connection without RLS context
  // RLS policies won't apply because no context is set
  return db;
}

/**
 * Execute admin operations in a transaction
 *
 * @example
 * ```typescript
 * await withAdminContext(async (tx) => {
 *   await tx.insert(OrganizationsTable).values(...);
 *   await tx.insert(UsersTable).values(...);
 * });
 * ```
 */
export async function withAdminContext<T>(
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return await db.transaction(fn);
}

/**
 * Test RLS context (for debugging)
 *
 * Returns the current user_id and org_id from the session context.
 *
 * @example
 * ```typescript
 * const context = await testRLSContext();
 * console.log('Current user:', context.userId);
 * console.log('Current org:', context.orgId);
 * ```
 */
export async function testRLSContext() {
  return await db.transaction(async (tx) => {
    const { user, organizationId } = await withAuth({ ensureSignedIn: true });
    await setRLSContext(tx, user.id, organizationId!);

    const userIdResult = await tx.execute(
      sql`SELECT current_setting('app.user_id', true) as user_id`,
    );
    const orgIdResult = await tx.execute(sql`SELECT current_setting('app.org_id', true) as org_id`);

    return {
      userId: userIdResult.rows[0]?.user_id,
      orgId: orgIdResult.rows[0]?.org_id,
      expectedUserId: user.id,
      expectedOrgId: organizationId,
    };
  });
}

/**
 * Type for database with RLS context
 */
export type RLSScopedDb = typeof db;
