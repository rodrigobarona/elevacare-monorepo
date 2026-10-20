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
export {
  Decrypted,
  isDecrypted,
  PHI_PLACEHOLDER,
  registerPhi,
  registeredPhiCount,
  scrubRegisteredPhi,
  withPhiScope,
} from "./phi"
export { SENTRY_EVENT_KEYS, sanitizeSentryEvent } from "./sentry-event"
export { initSentry, captureException, type SentryInitOptions } from "./sentry"
export { heartbeat } from "./heartbeat"
export { reportProbeFailure } from "./probes"
export { buildCspHeader, CSP_ALLOWLIST } from "./csp"

// withHeaders / proxy helpers are exposed only via the `@eleva/observability/proxy`
// subpath so packages that do not need Next types (audit, workflows,
// db) can import correlation + redaction without tsc trying to resolve
// `next/server`.
