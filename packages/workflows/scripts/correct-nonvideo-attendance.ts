/**
 * One-off repair of phone and in-person sessions that the attendance sweep
 * recorded as a no-show before 2026-11-11 (see the decision log, "A phone
 * or in-person session is never recorded as a no-show"). Dry run unless
 * `--apply`. Prints counts only, never booking ids.
 *
 *   pnpm video:correct-nonvideo-attendance            # count
 *   pnpm video:correct-nonvideo-attendance --apply    # correct, audited
 *
 * It uses the database in `.env.local`. For production, the operator
 * points that at the production main database (unpooled URL) on purpose,
 * after the fix is deployed: until then the sweep keeps writing new ones.
 */
import { correctNonVideoNoShows } from "../src/video/attendance-fallback"

async function main() {
  const apply = process.argv.includes("--apply")
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
