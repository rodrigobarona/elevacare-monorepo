/**
 * Next.js 16 server-side instrumentation entrypoint.
 *
 * Called once per server runtime (Node.js / Edge) before any request is
 * handled. We use it to wire up Sentry via `@eleva/observability`, which
 * itself is a no-op when no DSN is configured (local dev, tests).
 *
 * Without this file, calls to `captureException()` from anywhere in the
 * API (route handlers, drainers, the stripe-stuck-events workflow, etc.)
 * would silently no-op because `Sentry.init()` was never invoked. The
 * Phase 9 stuck-event drill in the post-merge review proved this — a
 * synthetic stuck row triggered the detector but Sentry never received
 * the issue. Adding this file fixes G3 from that audit.
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { assertE2eBypassNotInProduction } = await import("@/lib/e2e-env")
      assertE2eBypassNotInProduction()
      const { initSentry } = await import("@eleva/observability/sentry")
      await initSentry({ app: "api" })
      await reportMissingProductionEnv().catch((error: unknown) => {
        console.error("[api instrumentation] env report failed", error)
      })
      const { setAuthTransactionalMailer } =
        await import("@eleva/auth/server/auth")
      const { createAuthMailer } = await import("@eleva/notifications")
      setAuthTransactionalMailer(createAuthMailer())
      // An event written during a request is published once the request
      // has answered: the job that publishes them runs hourly.
      const { onDomainEventWritten } = await import("@eleva/db")
      const { publishDomainEventsAfterResponse } =
        await import("@/lib/publish-domain-events")
      onDomainEventWritten(publishDomainEventsAfterResponse)
    } catch (error) {
      console.error("[api instrumentation] register failed", error)
      throw error
    }
  }
}

/**
 * Report Vercel Production variables the API needs but does not have.
 * Reports names only, never values, and never blocks boot: most features
 * still work, and a crash loop would take the whole API down.
 */
async function reportMissingProductionEnv(): Promise<void> {
  if (process.env.VERCEL_ENV !== "production") return
  const { missingApiProductionEnv } =
    await import("@eleva/config/production-env")
  const missing = missingApiProductionEnv()
  if (missing.length === 0) return
  const message = `[api] Vercel Production is missing env: ${missing.join(", ")}`
  console.error(message)
  const { captureException } = await import("@eleva/observability/sentry")
  await captureException(new Error(message), { missing })
}

export async function onRequestError(
  ...args: Parameters<
    typeof import("@eleva/observability/sentry").captureRequestError
  >
): Promise<void> {
  const { captureRequestError } = await import("@eleva/observability/sentry")
  await captureRequestError(...args)
}
