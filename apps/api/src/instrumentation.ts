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
    const { initSentry } = await import("@eleva/observability/sentry")
    await initSentry({ app: "api" })
  }
}
