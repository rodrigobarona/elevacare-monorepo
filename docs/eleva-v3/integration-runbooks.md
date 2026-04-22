# Eleva.care v3 Integration Runbooks

Status: Living

## Purpose

This document defines the runbook structure for the major third-party integrations in Eleva.care v3.

It is intended for:

- engineering
- operations
- support

## Principles

- Every launch-critical integration should have a failure-handling playbook.
- The team should know what symptoms look like, how to investigate them, and when to escalate.
- Provider dashboards are useful, but Eleva should also have enough internal observability to debug workflows.

## Launch-Critical Integrations

The first runbooks should cover:

- WorkOS
- Stripe
- Daily
- Resend
- calendar providers
- PostHog where operationally relevant
- Sentry
- BetterStack
- Upstash where used for critical platform behavior

## Runbook Template

Each integration runbook should document:

- what the integration owns
- common failure modes
- user-visible symptoms
- where to inspect internal state
- where to inspect provider state
- retry or recovery guidance
- escalation path

## Required Runbooks

### WorkOS runbook

Should cover:

- sign-in failures
- session issues
- organization/membership mismatch
- permission claim issues

### Stripe runbook

Should cover:

- payment success but no booking finalization
- webhook failure
- refund issue
- payout transfer issue

### Daily runbook

Should cover:

- room/session creation issue
- join failure
- transcript not appearing
- transcript available but downstream workflow failed

### Resend runbook

Should cover:

- email not sent
- webhook issue
- template issue
- reminder delivery issue

### Calendar integration runbook

Should cover:

- calendar connection failure
- expired credentials
- no busy-time sync
- destination-calendar write failure

## Investigation Order

In general, the investigation order should be:

1. confirm user-visible symptom
2. identify affected object ids
3. inspect internal logs/events/workflow state
4. inspect provider dashboard or webhook history
5. determine retry, recovery, or escalation path

## Ownership

Each integration should have:

- a primary engineering owner
- an operational escalation path
- a support-facing summary for first-line triage

## Related Docs

- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
