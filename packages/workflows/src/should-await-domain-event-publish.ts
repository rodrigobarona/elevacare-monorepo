type PublisherEnv = {
  E2E_AUTH_CAPTURE?: string
  VERCEL_ENV?: string
  NODE_ENV?: string
  API_URL?: string
  NEXT_PUBLIC_API_URL?: string
}

function isLoopbackApiBase(apiBase: string): boolean {
  if (!apiBase) return true
  try {
    const host = new URL(apiBase).hostname.toLowerCase()
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]"
    )
  } catch {
    return false
  }
}

export function shouldAwaitDomainEventPublish(
  env: PublisherEnv = process.env as PublisherEnv
): boolean {
  if (
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview" ||
    env.NODE_ENV === "production"
  ) {
    return false
  }
  if (env.E2E_AUTH_CAPTURE === "1") return true
  return isLoopbackApiBase(env.API_URL ?? env.NEXT_PUBLIC_API_URL ?? "")
}
