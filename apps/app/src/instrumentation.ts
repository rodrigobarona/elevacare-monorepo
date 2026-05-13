/**
 * Next.js 16 server-side instrumentation entrypoint.
 *
 * Called once per server runtime (Node.js / Edge) before any request is
 * handled. We use it to wire up Sentry via `@eleva/observability`, which
 * itself is a no-op when no DSN is configured (local dev, tests).
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("@eleva/observability/sentry")
    await initSentry({ app: "app" })
  }
}
