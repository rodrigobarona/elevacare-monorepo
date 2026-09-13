const FALLBACK_ORIGIN = "http://localhost:3002"

type MagicLinkEnv = {
  BETTER_AUTH_URL?: string
}

export function magicLinkServerOrigin(
  env: MagicLinkEnv = process.env as MagicLinkEnv
): string {
  const raw = env.BETTER_AUTH_URL ?? `${FALLBACK_ORIGIN}/auth`
  try {
    return new URL(raw).origin
  } catch {
    return FALLBACK_ORIGIN
  }
}

/** Headers Better Auth `signInMagicLink` requires (`requireHeaders: true`). */
export function magicLinkServerHeaders(
  env: MagicLinkEnv = process.env as MagicLinkEnv
): Headers {
  return new Headers({
    origin: magicLinkServerOrigin(env),
    "content-type": "application/json",
  })
}
