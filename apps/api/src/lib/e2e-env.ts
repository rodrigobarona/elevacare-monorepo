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

export function isE2eAuthBypassMounted(): boolean {
  return (
    process.env.VERCEL_ENV !== "production" &&
    Boolean(process.env.E2E_AUTH_BYPASS_TOKEN)
  )
}
