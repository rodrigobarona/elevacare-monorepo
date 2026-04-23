export {
  getCorrelationId,
  withCorrelationId,
  correlationIdHeader,
  generateCorrelationId,
} from "./correlation"
export {
  REDACTED_KEYS,
  REDACTED_VALUE_PATTERNS,
  shouldRedactKey,
  redactString,
  redactPayload,
} from "./redaction"
export { initSentry, captureException, type SentryInitOptions } from "./sentry"
export { heartbeat } from "./heartbeat"
export { buildCspHeader, CSP_ALLOWLIST } from "./csp"

// withHeaders / proxy helpers are exposed only via the `@eleva/observability/proxy`
// subpath so packages that do not need Next types (audit, workflows,
// db) can import correlation + redaction without tsc trying to resolve
// `next/server`.
