import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/audit/**/*.ts",
  out: "./src/migrations/audit",
  dbCredentials: {
    url:
      process.env.AUDIT_DATABASE_URL_UNPOOLED ??
      process.env.AUDIT_DATABASE_URL ??
      "",
  },
  strict: true,
  verbose: true,
})
