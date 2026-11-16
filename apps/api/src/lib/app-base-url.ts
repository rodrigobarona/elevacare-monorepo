/**
 * Base URL of the member-facing app, for Stripe return URLs. Blank values
 * fall through, matching the production env check in
 * `@eleva/config/production-env`.
 */
export function appBaseUrl(
  env: Record<string, string | undefined> = process.env
): string {
  const base =
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    env.APP_URL?.trim() ||
    "https://eleva.care"
  return base.replace(/\/+$/, "")
}
