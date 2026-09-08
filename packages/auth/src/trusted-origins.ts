const LOCAL_APP_ORIGINS = Array.from(
  { length: 10 },
  (_, index) => `http://localhost:${3000 + index}`
)

const DEFAULT_TRUSTED_ORIGINS = [
  "https://eleva.care",
  "https://www.eleva.care",
  "https://api.eleva.care",
  "https://dev.eleva.care",
  "https://api.dev.eleva.care",
  "https://admin.eleva.care",
  "https://admin.dev.eleva.care",
  ...LOCAL_APP_ORIGINS,
]

export function trustedOrigins(): string[] {
  const extra = (process.env.ELEVA_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
  return [...new Set([...DEFAULT_TRUSTED_ORIGINS, ...extra])]
}

export function isTrustedOrigin(origin: string | null): boolean {
  if (!origin) return false
  return trustedOrigins().includes(origin)
}
