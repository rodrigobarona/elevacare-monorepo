/**
 * One-off repair of phone and in-person sessions (see the decision log, "A
 * phone or in-person session is never recorded as a no-show"):
 *
 * 1. sessions the attendance sweep recorded as a no-show before 2026-11-11
 *    are set to what their booking says (cancelled, open again, or ended);
 * 2. sessions still open that kept an old time after the member moved the
 *    booking take the booking's time.
 *
 * Every change is written to the audit log. It only counts unless both
 * `--apply` and `--confirm-host=<host>` are given, and the host must be the
 * one it prints: a guard against changing a database you did not mean to.
 * Prints counts only, never booking ids.
 *
 *   pnpm video:correct-nonvideo-attendance
 *   pnpm video:correct-nonvideo-attendance --apply --confirm-host=<host>
 *
 * It uses `DATABASE_URL` from `.env.local`. For production, the operator
 * points that at the production main database (unpooled URL) on purpose,
 * after the fix is deployed (until then the sweep keeps writing new false
 * no-shows), and puts `.env.local` back straight after.
 */
import {
  correctNonVideoNoShows,
  syncNonVideoSessionTimes,
} from "../src/video/attendance-fallback"

/** The database about to be read or changed: host only, never credentials. */
function databaseHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname || "unknown"
  } catch {
    return "unknown"
  }
}

async function main() {
  const host = databaseHost()
  console.log(`database: ${host}`)
  const apply = process.argv.includes("--apply")
  if (apply) {
    const confirmed = process.argv
      .find((arg) => arg.startsWith("--confirm-host="))
      ?.slice("--confirm-host=".length)
    if (confirmed !== host) {
      throw new Error(
        `--apply needs --confirm-host=${host} (the database printed above)`
      )
    }
  }

  if (!apply) {
    const noShows = await correctNonVideoNoShows({ apply: false })
    const times = await syncNonVideoSessionTimes({ apply: false })
    console.log(`false no-shows to correct: ${noShows.found}`)
    console.log(`open sessions with an old time: ${times.found}`)
    console.log("(each count shows the first 500 at most; nothing was changed)")
    return
  }

  let corrected = 0
  for (;;) {
    const result = await correctNonVideoNoShows({ apply: true })
    corrected += result.corrected
    if (result.found === 0) break
    if (result.corrected === 0) {
      throw new Error("correction made no progress; stopping")
    }
  }
  let synced = 0
  for (;;) {
    const result = await syncNonVideoSessionTimes({ apply: true })
    synced += result.synced
    if (result.found === 0) break
    if (result.synced === 0) {
      throw new Error("time sync made no progress; stopping")
    }
  }
  console.log(`done: ${corrected} false no-show(s) corrected`)
  console.log(`done: ${synced} session time(s) brought up to date`)
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
)
