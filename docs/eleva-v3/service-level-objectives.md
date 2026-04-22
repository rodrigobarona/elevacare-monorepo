# Eleva.care v3 Service Level Objectives

Status: Living

## Purpose

This document defines the initial reliability expectations for Eleva.care v3.

It is not meant to be overly formal on day one. It is meant to establish which journeys matter most and what reliability standard the team should design toward.

## Principles

- Reliability should be defined around user journeys, not only infrastructure.
- Not every page needs the same target.
- High-trust workflows deserve explicit reliability goals.

## Candidate Critical Journeys

The team should treat these as the first SLO-worthy journeys:

- sign in / account activation
- public expert discovery
- booking flow
- payment completion
- session access and reminders
- transcript pipeline
- patient report/document access
- payout review and transfer workflow

## Initial SLO Categories

### Availability

Questions to answer:

- can the user reach and use the flow
- does the system stay up enough for the intended trust level

### Correctness

Questions to answer:

- is the booking/payment/session state correct
- are retries/idempotency protecting correctness

### Timeliness

Questions to answer:

- how quickly do reminders arrive
- how quickly do transcripts appear
- how quickly do AI drafts become available

## Suggested Early Measurement Mindset

The first version does not need perfect numerical targets everywhere.
But the team should define:

- which flows are critical
- which metrics reflect health
- which failures are launch blockers

## Candidate Signals

- booking failure rate
- payment success/failure mismatch rate
- reminder delivery failure rate
- transcript-ready delay
- AI draft failure rate
- payout backlog age

## Related Docs

- [`ops-observability-spec.md`](./ops-observability-spec.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
- [`integration-runbooks.md`](./integration-runbooks.md)
