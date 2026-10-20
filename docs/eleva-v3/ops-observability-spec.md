# Eleva.care v3 Operations And Observability Spec

Status: Living

## Purpose

This document defines the operational and observability direction for Eleva.care v3.

It should guide:

- monitoring
- logging
- incident readiness
- environment strategy
- workflow/job visibility
- production hardening

## Operational Principles

- Observability should be designed into the platform, not bolted on after launch.
- High-risk workflows must be traceable end to end.
- Operational metadata and sensitive business data must be handled differently.
- The team should prefer actionable signals over noisy dashboards.
- Every critical user journey should have a way to be monitored and debugged.

## Core Tooling Direction

Planned tooling:

- Sentry for error tracking
- BetterStack for logging and uptime/monitoring
- PostHog for product analytics
- provider-specific dashboards where required

## Critical Journeys To Observe

The platform should make these journeys observable:

- sign in / activation
- expert onboarding
- public booking flow
- payment success/failure
- booking confirmation and reminder pipeline
- session creation and Daily integration
- transcript availability
- AI report generation and review
- payout eligibility and payout approval
- diary sharing visibility changes

## Logging Strategy

The system should produce structured logs for:

- request handling
- webhook processing
- workflow/job execution
- integration failures
- high-risk admin actions

Logs should include:

- correlation identifiers
- relevant object identifiers
- environment
- operation type

Logs should not casually include sensitive content.

### Clinical content (PHI) guards

Record and document code follows these rules, enforced in code rather than by convention:

- Decryption returns `Decrypted<T>` (`@eleva/observability`). It prints `[redacted]` through
  `JSON.stringify`, `util.inspect` and string coercion. Code must call `reveal()` explicitly, and
  only to map into a response DTO validated by a Zod response schema.
- Every plaintext produced by decryption, and every record body received on `PUT
/sessions/{bookingId}/records`, is registered in a per-request PHI registry
  (`withPhiScope`, `AsyncLocalStorage`). `redactString` replaces any registered value with `[phi]`
  wherever it appears, including `Error.message`. Values shorter than six characters are not
  registered. Outside a scope, registration does nothing, so values cannot leak between requests.
- Record and document routes log only through `recordLogger` (`@eleva/records`). Its payload is an
  allow-list of scalar IDs, `status`, `modelId`, `tokenCount` and `durationMs`. Other keys are
  dropped at runtime. Errors are logged as class name and code, never as their message.
- Sentry `beforeSend` and `beforeSendTransaction` walk the whole event, redact record keys
  (`body`, `title`, `notes`, `transcript`, `summary`, `observations`, `recommendations`) and
  `Decrypted` values, scrub registered PHI from every string, and drop unknown top-level event keys.

Still to do: an ESLint rule that forbids passing a `Decrypted` value to `NextResponse.json` or
`secureJson`, and deriving the AI output keys from the `draftSessionReport` Zod schema once it exists
(Phase 10.2b).

## Error Tracking Strategy

Sentry should capture:

- frontend errors
- backend/API errors
- workflow failures
- integration failures

The team should enrich errors with safe metadata that helps debugging without exposing sensitive payloads.

## Metrics And Health Signals

The platform should define health signals for:

- API uptime
- booking conversion failure rate
- payment failure rate
- reminder delivery failure rate
- webhook failure rate
- transcript pipeline delay/failure
- AI generation failure rate
- payout backlog/approval backlog

## Uptime And Health Checks

The platform should expose at least:

- basic health endpoint
- service readiness checks where appropriate
- critical dependency health indicators where feasible

## Webhooks And Workflows

Because Eleva depends on multiple external systems, the team should treat webhooks and workflows as first-class operational surfaces.

The system should support:

- idempotency
- retries
- dead-letter or failure review strategy
- visibility into execution status

## Environment Model

At minimum:

- staging
- production

The environment model should clearly define:

- which integrations are enabled where
- which callbacks/webhooks map to which environment
- how environment variables are managed
- how preview environments are treated

## Incident Readiness

The team should produce:

- incident escalation paths
- service ownership by workstream
- runbooks for common failures
- rollback guidance for risky changes

## Security And Compliance Considerations

Operational tooling must not weaken privacy boundaries.

The team should avoid:

- logging sensitive content to generic sinks
- sending transcript/report/diary contents into observability tools by default
- over-broad access to admin dashboards and logs

## Recommended First Operational Runbooks

The first set of runbooks should cover:

- booking failures
- Stripe webhook failures
- calendar sync failures
- reminder delivery failures
- Daily/transcript pipeline failures
- AI generation failures
- payout transfer issues

## Open Questions

- exact BetterStack logging architecture
- final workflow engine strategy for durable jobs
- which metrics should be operational blockers at launch
- who owns each runbook and on-call path

## Related Docs

- [`notifications-spec.md`](./notifications-spec.md)
- [`payments-payouts-spec.md`](./payments-payouts-spec.md)
- [`ai-reporting-spec.md`](./ai-reporting-spec.md)
- [`compliance-data-governance.md`](./compliance-data-governance.md)
