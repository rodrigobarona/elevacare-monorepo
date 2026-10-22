/**
 * Next.js 16 server-side instrumentation entrypoint.
 *
 * This app renders clinical/member data, so server errors reach Sentry
 * only through `@eleva/observability` (PHI redaction in `beforeSend`,
 * no-op without a DSN). Phase 10 acceptance requires every PHI-rendering
 * app to wire it; marketing apps (web, docs, academy) do not.
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("@eleva/observability/sentry")
    await initSentry({ app: "admin" })
  }
}
