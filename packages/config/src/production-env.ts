/**
 * Variables `apps/api` needs in Vercel Production. Each entry lists the
 * names the code accepts, in the order it reads them; one non-empty value
 * satisfies the entry.
 *
 * Most of these are read lazily, so a missing one only fails the request
 * or workflow that needs it (booking reminders without `API_URL`,
 * invitation links pointing at localhost without `ACCOUNT_URL`, account
 * deletion without `RETENTION_PSEUDONYM_KEY`). The API checks this list
 * once at startup and reports the gaps, so a missing variable shows up the
 * first time a deployment boots instead of the first time a member hits it.
 */
export const API_PRODUCTION_ENV: ReadonlyArray<readonly [string, ...string[]]> =
  [
    ["API_URL"],
    ["ACCOUNT_URL", "NEXT_PUBLIC_ACCOUNT_URL"],
    ["NEXT_PUBLIC_APP_URL", "APP_URL"],
    ["BETTER_AUTH_URL"],
    ["BETTER_AUTH_SECRET"],
    ["DATABASE_URL"],
    ["AUDIT_DATABASE_URL"],
    ["ELEVA_KEK_V1"],
    ["CONSENT_HASH_KEY"],
    ["RETENTION_PSEUDONYM_KEY"],
    ["CRON_SECRET"],
    ["WORKFLOWS_DRAIN_SECRET"],
    ["QSTASH_TOKEN"],
    ["QSTASH_CURRENT_SIGNING_KEY"],
    ["QSTASH_NEXT_SIGNING_KEY"],
    ["KV_REST_API_URL"],
    ["KV_REST_API_TOKEN"],
    ["RESEND_API_KEY"],
    ["RESEND_WEBHOOK_SECRET"],
    ["STRIPE_SECRET_KEY"],
    ["STRIPE_WEBHOOK_SECRET"],
    ["STRIPE_CONNECT_WEBHOOK_SECRET"],
    ["DAILY_API_KEY"],
    ["DAILY_WEBHOOK_SECRET"],
    ["R2_ACCOUNT_ID"],
    ["R2_PUBLIC_BUCKET"],
    ["R2_PUBLIC_ACCESS_KEY_ID"],
    ["R2_PUBLIC_SECRET_ACCESS_KEY"],
    ["R2_PUBLIC_BASE_URL"],
    ["R2_PRIVATE_BUCKET"],
    ["R2_PRIVATE_ACCESS_KEY_ID"],
    ["R2_PRIVATE_SECRET_ACCESS_KEY"],
    ["TWILIO_ACCOUNT_SID"],
    ["TWILIO_AUTH_TOKEN"],
    ["TWILIO_MESSAGING_SERVICE_SID", "TWILIO_MESSAGE_SERVICE_SID"],
  ]

/** Names of the unmet entries (first accepted name of each). Never values. */
export function missingApiProductionEnv(
  env: Record<string, string | undefined> = process.env
): string[] {
  return API_PRODUCTION_ENV.filter(
    (names) => !names.some((name) => env[name]?.trim())
  ).map((names) => names[0])
}
