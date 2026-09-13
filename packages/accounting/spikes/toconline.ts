/**
 * Throwaway 07.0 runner. Does not issue invoices.
 *
 *   pnpm exec tsx --env-file=.env.local packages/accounting/spikes/toconline.ts
 *
 * Requires TOCONLINE_SERIES_PREFIX to start with TEST-. Live ELEVA series
 * exits 2 without calling TOConline.
 */
import { assertTestSeriesPrefix } from "./series-guard"

function envHost(name: string): string | undefined {
  const value = process.env[name]
  if (!value) return undefined
  try {
    return new URL(value).host
  } catch {
    return "(unparseable URL)"
  }
}

function main(): void {
  const prefix = process.env.TOCONLINE_SERIES_PREFIX
  try {
    assertTestSeriesPrefix(prefix)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    console.error(
      `Current TOCONLINE_SERIES_PREFIX=${prefix ?? "(unset)"}. Create a TEST- series in the Eleva TOConline sandbox, set TOCONLINE_SERIES_PREFIX=TEST-…, then re-run.`
    )
    process.exit(2)
  }

  const apiBase =
    process.env.TOCONLINE_API_BASE_URL || process.env.TOCONLINE_API_URL
  const oauthBase =
    process.env.TOCONLINE_OAUTH_BASE_URL || process.env.TOCONLINE_OAUTH_URL
  const redirect =
    process.env.TOCONLINE_OAUTH_REDIRECT || process.env.TOCONLINE_URI_REDIRECT

  console.log("07.0 spike: TEST- series guard passed.")
  console.log(`series prefix: ${prefix}`)
  console.log(
    `API host (from env, not hardcoded): ${envHost("TOCONLINE_API_BASE_URL") ?? envHost("TOCONLINE_API_URL") ?? "(missing)"}`
  )
  console.log(
    `OAuth host (from env, not hardcoded): ${envHost("TOCONLINE_OAUTH_BASE_URL") ?? envHost("TOCONLINE_OAUTH_URL") ?? "(missing)"}`
  )
  console.log(
    `redirect set: ${redirect ? "yes" : "no"}  client id set: ${process.env.TOCONLINE_CLIENT_ID ? "yes" : "no"}`
  )
  console.log(
    "Issuance, AT communication, and credit notes are not run by this scaffold. See docs/eleva-v3/spikes/07-toconline.md."
  )

  if (!apiBase || !oauthBase || !process.env.TOCONLINE_CLIENT_ID) {
    console.error(
      "Missing TOCONLINE_API_BASE_URL / TOCONLINE_OAUTH_BASE_URL (or legacy TOCONLINE_API_URL / TOCONLINE_OAUTH_URL) or TOCONLINE_CLIENT_ID."
    )
    process.exit(2)
  }
}

main()
