/**
 * One-off repair of phone and in-person sessions that the attendance sweep
 * recorded as a no-show before 2026-11-11 (see the decision log, "A phone
 * or in-person session is never recorded as a no-show"). Dry run unless
 * `--apply`. Prints counts only, never booking ids.
 *
 *   pnpm video:correct-nonvideo-attendance            # count
 *   pnpm video:correct-nonvideo-attendance --apply    # correct, audited
 *
 * It uses the database in `.env.local` and prints its host first. For
 * production, the operator points `DATABASE_URL` there at the production
 * main database (unpooled URL) on purpose, after the fix is deployed (until
 * then the sweep keeps writing new ones), and puts `.env.local` back
 * straight after.
 */
import { correctNonVideoNoShows } from "../src/video/attendance-fallback"

/** The database about to be read or changed: host only, never credentials. */
function databaseHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname || "unknown"
  } catch {
    return "unknown"
  }
}

async function main() {
  const apply = process.argv.includes("--apply")
  console.log(`database: ${databaseHost()}`)
  let total = 0
  for (;;) {
    const result = await correctNonVideoNoShows({ apply })
    if (!apply) {
      console.log(`to correct: ${result.found} (first 500 at most)`)
      return
    }
    total += result.corrected
    console.log(`corrected ${result.corrected} of ${result.found}`)
    if (result.found === 0) break
    if (result.corrected === 0) {
      throw new Error("correction made no progress; stopping")
    }
  }
  console.log(`done: ${total} session(s) corrected`)
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
)
