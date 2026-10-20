/**
 * Re-wraps org DEKs under the current KEK (ADR-020). Dry run unless
 * `--apply`. Prints counts only, never keys or org ids.
 *
 *   pnpm encryption:rotate-kek            # dry run
 *   pnpm encryption:rotate-kek --apply
 *
 * Production KEKs are write-only Vercel env vars; rotate there via
 * `POST /workflows/kek-rotation` instead.
 */
import { rotateAllOrgKeks } from "../src/keys"

async function main() {
  const apply = process.argv.includes("--apply")
  let total = 0
  for (;;) {
    const result = await rotateAllOrgKeks({ dryRun: !apply })
    total += result.orgs
    console.log(
      `${apply ? "rotated" : "pending"} kek=v${result.kekVersion} orgs=${result.orgs} rewrapped=${result.rewrapped} hasMore=${result.hasMore}`
    )
    if (!apply || !result.hasMore) break
    if (result.rewrapped === 0) {
      throw new Error("rotation made no progress; stopping")
    }
  }
  if (apply) console.log(`done: ${total} org(s) re-wrapped`)
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
)
