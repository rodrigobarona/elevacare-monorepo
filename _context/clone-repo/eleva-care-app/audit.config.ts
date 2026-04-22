/**
 * ⚠️ TODO: DEPRECATED - Migrate to Unified Audit Schema
 *
 * This separate audit database config is deprecated.
 * AuditLogsTable is now unified in drizzle/schema-workos.ts (lines 1290-1316)
 *
 * Migration Tasks:
 * 1. Update src/lib/utils/server/audit.ts to use main db with AuditLogsTable
 * 2. Update all audit logging calls (13 files) to use unified schema
 * 3. Migrate existing audit data to main database
 * 4. Remove audit.config.ts, auditDb.ts, auditSchema.ts
 * 5. Remove AUDITLOG_DATABASE_URL from .env
 *
 * Benefits:
 * - Simpler architecture (one database instead of two)
 * - Unified RLS protection
 * - Easier querying and reporting
 * - Lower infrastructure costs
 */
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle/migrations',
  schema: './drizzle/auditSchema.ts',
  dialect: 'postgresql',
  verbose: true,
  strict: true,
  dbCredentials: {
    url: process.env.AUDITLOG_DATABASE_URL!,
  },
});
