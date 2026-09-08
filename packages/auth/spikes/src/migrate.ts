import { getMigrations } from "better-auth/db/migration"
import { auth, pool } from "./auth.ts"

const { runMigrations, toBeAdded, toBeCreated } = await getMigrations(
  auth.options
)
console.log("toBeCreated", toBeCreated)
console.log("toBeAdded", toBeAdded)
try {
  await runMigrations()
  console.log("migrations applied")
} finally {
  await pool.end()
}
