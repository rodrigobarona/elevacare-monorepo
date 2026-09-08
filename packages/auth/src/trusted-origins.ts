const LOCAL_APP_PORTS = Array.from({ length: 10 }, (_, index) => 3000 + index)

const DEFAULT_TRUSTED_ORIGINS = [
  "https://eleva.care",
  "https://www.eleva.care",
  "https://api.eleva.care",
  "https://dev.eleva.care",
  "https://api.dev.eleva.care",
  "https://admin.eleva.care",
  "https://admin.dev.eleva.care",
]

type OriginEnv = {
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

export function trustedOrigins(env: OriginEnv = process.env): string[] {
  const extra = (env.ELEVA_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
  return [
    ...new Set([...DEFAULT_TRUSTED_ORIGINS, ...localAppOrigins(env), ...extra]),
  ]
}

export function isTrustedOrigin(origin: string | null): boolean {
  if (!origin) return false
  return trustedOrigins().includes(origin)
}
