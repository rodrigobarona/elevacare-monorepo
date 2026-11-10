import { apexAllowed } from "@eleva/config/apex"

const LOCAL_APP_PORTS = [
  ...Array.from({ length: 10 }, (_, index) => 3000 + index),
  3100,
  3102,
]

// The apex (eleva.care, www.eleva.care) is added only once it serves v3.
const APEX_ORIGINS = ["https://eleva.care", "https://www.eleva.care"]

const DEFAULT_TRUSTED_ORIGINS = [
  "https://api.eleva.care",
  "https://dev.eleva.care",
  "https://api.dev.eleva.care",
  "https://admin.eleva.care",
  "https://admin.dev.eleva.care",
  // The gateway rewrites to these app hosts. Their Server Components call the
  // API with no browser Origin, so the forwarded Origin is the app's own host
  // and cookie mutations (CSRF check) are refused unless it is listed.
  "https://app.eleva.care",
  "https://account.eleva.care",
  "https://expert.eleva.care",
  "https://team.eleva.care",
  "https://academy.eleva.care",
]

type OriginEnv = {
  ELEVA_APEX_IS_V3?: string
  VERCEL_ENV?: string
  NODE_ENV?: string
  ELEVA_TRUSTED_ORIGINS?: string
}

function isDeployedTrustList(env: OriginEnv = process.env): boolean {
  return (
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview" ||
    env.NODE_ENV === "production"
  )
}

function localAppOrigins(env: OriginEnv = process.env): string[] {
  if (isDeployedTrustList(env)) return []
  return LOCAL_APP_PORTS.flatMap((port) => [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ])
}

function isApprovedDeployedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    if (url.protocol !== "https:") return false
    const host = url.hostname
    return host === "eleva.care" || host.endsWith(".eleva.care")
  } catch {
    return false
  }
}

export function trustedOrigins(env: OriginEnv = process.env): string[] {
  const extra = (env.ELEVA_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
  const extras = isDeployedTrustList(env)
    ? extra.filter(isApprovedDeployedOrigin)
    : extra
  return [
    ...new Set([
      ...DEFAULT_TRUSTED_ORIGINS,
      ...APEX_ORIGINS,
      ...localAppOrigins(env),
      ...extras,
    ]),
  ].filter((origin) => apexAllowed(origin, env))
}

export function isTrustedOrigin(origin: string | null): boolean {
  if (!origin) return false
  return trustedOrigins().includes(origin)
}
