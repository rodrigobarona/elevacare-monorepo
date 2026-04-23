import { env } from "@eleva/config/env"
import { getCorrelationId } from "./correlation"
import { redactPayload } from "./redaction"

/**
 * Sentry init helpers. We wrap `@sentry/nextjs` instead of importing it
 * everywhere so:
 *   - the redaction beforeSend hook is always applied (cannot be bypassed)
 *   - correlation IDs are attached as a tag automatically
 *   - the SDK is a thin optional dep elsewhere
 *
 * Boundary rule: `@sentry/*` imports outside this package are rejected.
 */

export interface SentryInitOptions {
  /** Set per-app so release tagging works; defaults to NEXT_PUBLIC_VERSION. */
  release?: string
  /** 'web' | 'app' | 'api' | 'docs' etc. \u2014 used as a tag. */
  app?: string
  /** 0-1 sample rate for performance traces. */
  tracesSampleRate?: number
}

async function loadSentry() {
  // Dynamic import so consumers that only pull observability for
  // withHeaders or correlation helpers do not pay the Sentry bundle cost.
  return import("@sentry/nextjs")
}

export async function initSentry(
  options: SentryInitOptions = {}
): Promise<void> {
  const e = env()
  if (!e.SENTRY_DSN && !e.NEXT_PUBLIC_SENTRY_DSN) {
    // No-op when DSN not configured (local dev, tests).
    return
  }
  const Sentry = await loadSentry()
  Sentry.init({
    dsn: e.SENTRY_DSN ?? e.NEXT_PUBLIC_SENTRY_DSN,
    environment: e.NODE_ENV,
    release: options.release,
    tracesSampleRate: options.tracesSampleRate ?? 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      // Tag with correlation id if one is in ALS.
      const cid = getCorrelationId()
      if (cid) {
        event.tags = { ...event.tags, correlation_id: cid }
      }
      if (options.app) {
        event.tags = { ...event.tags, app: options.app }
      }
      // Deep-redact the event payload so PHI/PCI never leaves the box.
      return redactPayload(event)
    },
    beforeBreadcrumb(breadcrumb) {
      return redactPayload(breadcrumb)
    },
  })
}

/**
 * Escape hatch for manual captureException wrapped in redaction.
 */
export async function captureException(
  err: unknown,
  context?: Record<string, unknown>
) {
  const Sentry = await loadSentry()
  const safeContext = context ? redactPayload(context) : undefined
  Sentry.captureException(err, safeContext ? { extra: safeContext } : undefined)
}
