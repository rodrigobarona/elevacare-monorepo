import { redactString } from "./redaction"
import { captureException } from "./sentry"

const MAX_CAUSE_DEPTH = 4

/**
 * A log-safe description of an error: class names and codes along the
 * cause chain, never messages. Database errors carry the bound query
 * parameters (names, emails, health notes) in their message, so messages
 * stay out of plain logs. Example: `DrizzleQueryError <- error:42P10`.
 */
export function describeError(err: unknown): string {
  const parts: string[] = []
  let current: unknown = err
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (current === undefined || current === null) break
    if (!(current instanceof Error)) {
      parts.push(typeof current)
      break
    }
    const code = (current as { code?: unknown }).code
    parts.push(
      typeof code === "string" || typeof code === "number"
        ? `${current.name}:${code}`
        : current.name
    )
    current = (current as { cause?: unknown }).cause
  }
  return parts.join(" <- ")
}

/**
 * Log a caught error without its message, and send the full error to
 * Sentry, whose `beforeSend` hook redacts it. Use instead of
 * `console.error(event, err)` in route handlers and workflows.
 */
export function logError(event: string, err: unknown): void {
  console.error(redactString(event), describeError(err))
  void captureException(err, { event }).catch(() => undefined)
}
