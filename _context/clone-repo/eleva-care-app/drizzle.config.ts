import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Determine if the current operation requires a live database connection.
 * Generation-only operations (like `drizzle-kit generate`) don't need a real URL,
 * but operations like `push`, `migrate`, `studio`, etc. do require a live connection.
 */
function requiresDatabaseConnection(): boolean {
  const args = process.argv.slice(2);

  // Operations that only generate SQL/types and don't need a live DB connection
  const generateOnlyCommands = ['generate', 'generate:sql', 'check'];

  // Check if the command is a generation-only operation
  return !args.some((arg) => generateOnlyCommands.includes(arg));
}

/**
 * Get and validate the DATABASE_URL environment variable.
 * Throws a clear error if the URL is missing when required.
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    if (requiresDatabaseConnection()) {
      throw new Error(
        '❌ DATABASE_URL environment variable is required for this operation.\n' +
          '   Set it in your .env file or environment:\n' +
          '   DATABASE_URL="postgresql://user:password@host:port/database"\n\n' +
          '   For local development, you can use:\n' +
          '   - Neon.tech (recommended for preview branches)\n' +
          '   - Local PostgreSQL instance\n' +
          '   - Docker: docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres',
      );
    }

    // For generation-only operations, return a placeholder
    // This allows schema introspection without a live database
    return 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
  }

  return url;
}

export default defineConfig({
  out: './drizzle/migrations',
  schema: './drizzle/schema.ts', // Updated to WorkOS schema
  dialect: 'postgresql',
  verbose: true,
  strict: true,
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
