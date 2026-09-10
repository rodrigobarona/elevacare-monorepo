import { captureException } from "./sentry"

/**
 * Page on-call when a synthetic staging probe fails.
 *
 * Wraps `captureException` so cron/workflow callers do not import Sentry
 * directly. Redaction still runs inside `captureException`.
 */
export async function reportProbeFailure(
  probe: string,
  err: unknown,
  extra?: Record<string, unknown>
): Promise<void> {
  await captureException(err, { ...extra, probe })
}
