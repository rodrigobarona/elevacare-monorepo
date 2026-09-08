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

- Better Auth
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

### Better Auth runbook

Should cover:

- sign-in failures
- session / cookie issues on `.eleva.care`
- organization/membership mismatch
- permission / capability issues

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

### Envelope KEK rotation (ADR-020)

`@eleva/encryption` wraps each org DEK with `ELEVA_KEK_V<n>` (base64, 32 bytes).
The highest `n` present at process start is current. Never log KEK or DEK bytes.
Generate a new version with `openssl rand -base64 32`.

1. Add `ELEVA_KEK_V<n+1>` next to the existing `ELEVA_KEK_V<n>` in Vercel (all
   apps that import `@eleva/encryption`, at least `apps/api`). Do not delete the
   old var yet.
2. Deploy so every instance loads the new current version.
3. For each org, call `rotateKek(orgId)` from `@eleva/encryption`. This re-wraps
   DEK rows only; stored ciphertext stays readable because decrypt loads the DEK
   by `dek_v`, not by the `kek_v` prefix.
4. Confirm every `org_data_keys` row (including retired) has `kek_version` equal
   to the new `n` — zero rows may still reference the old key. Keep
   `ELEVA_KEK_V<n>` in env until that count is zero. Then the old var can leave
   Vercel; store it offline until Phase 14 record export is done.
5. `shredOrgKeys(orgId)` is erasure, not rotation — it deletes DEK rows and
   makes ciphertext permanently unreadable (`KEY_SHREDDED`).

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
