# Eleva.care v3 Support Escalation Matrix

Status: Living

## Purpose

This document defines how support and issue escalation should work across Eleva v3.

It should help the team answer:

- who handles what first
- when an issue becomes engineering-owned
- which issues require immediate escalation

## Principles

- The first responder should not guess at escalation paths.
- Severity should be based on user impact and business risk.
- Sensitive-data and payment issues should escalate faster than low-risk UX issues.

## Suggested Severity Levels

### Sev 1

Examples:

- booking/payment flow broadly broken
- sign-in broadly broken
- production incident affecting many users
- high-risk data exposure suspicion

### Sev 2

Examples:

- an important integration failing for a subset of users
- transcripts or reminders failing for real users
- payouts blocked or inconsistent

### Sev 3

Examples:

- isolated user/account issue
- recoverable support request
- non-blocking product inconsistency

### Sev 4

Examples:

- minor UX/content issue
- low-risk internal tooling issue

## Escalation Roles

The team should later attach names to these roles:

- support first responder
- domain owner
- engineering escalation owner
- ops/platform owner
- compliance/security escalation owner

## Fast-Escalation Categories

These should escalate quickly:

- payment or payout issues
- data visibility/privacy issues
- auth/RBAC issues
- incident-level integration failures
- transcript/report visibility failures with user impact

## Triage Expectations

The first responder should collect:

- affected user/org identifiers
- affected booking/session/payment identifiers
- when the issue started
- visible symptom
- whether it is isolated or widespread

## Related Docs

- [`owner-map.md`](./owner-map.md)
- [`admin-operator-playbooks.md`](./admin-operator-playbooks.md)
- [`integration-runbooks.md`](./integration-runbooks.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
