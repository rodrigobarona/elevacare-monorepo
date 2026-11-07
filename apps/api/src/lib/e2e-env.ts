export function assertE2eBypassNotInProduction(): void {
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.E2E_AUTH_BYPASS_TOKEN
  ) {
    throw new Error(
      "E2E_AUTH_BYPASS_TOKEN must not be set when VERCEL_ENV=production"
    )
  }
}

/**
 * Mounted only off Vercel (local and CI loopback runs). Preview
 * deployments run unreviewed branch code, so they never get the bypass.
 */
export function isE2eAuthBypassMounted(): boolean {
  const vercelEnv = process.env.VERCEL_ENV
  return (
    (vercelEnv === undefined || vercelEnv === "development") &&
    Boolean(process.env.E2E_AUTH_BYPASS_TOKEN)
  )
}
