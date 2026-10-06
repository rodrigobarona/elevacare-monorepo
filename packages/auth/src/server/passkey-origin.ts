/**
 * WebAuthn origins are the frontends where passkeys are registered, never
 * the API origin. `PASSKEY_ORIGIN` is comma-separated. Required on Vercel
 * production/preview; locally `null` lets the client supply its own origin.
 */
export function passkeyOrigins(): string[] | null {
  const origins = (process.env.PASSKEY_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean)
  if (origins.length > 0) return origins
  const vercelEnv = process.env.VERCEL_ENV
  if (vercelEnv === "production" || vercelEnv === "preview") {
    throw new Error(
      "PASSKEY_ORIGIN is required on Vercel production and preview (frontend origin, e.g. https://eleva.care)"
    )
  }
  return null
}
