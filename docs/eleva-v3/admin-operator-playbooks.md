# Eleva.care v3 Admin And Operator Playbooks

Status: Living

## Purpose

This document defines the playbook structure for Eleva internal admins and operators.

It should help the team answer:

- what internal staff can do
- how sensitive operational actions should be handled
- which actions require auditability or escalation

## Principles

- Internal operational access must be explicit and least-privilege.
- Admin/operator convenience must not bypass privacy or audit boundaries.
- High-risk actions should follow a documented playbook, not improvisation.

## Role Intent

### Operator

Typical focus:

- support triage
- workflow issue investigation
- onboarding follow-up
- reminder/delivery troubleshooting

### Admin

Typical focus:

- higher-trust configuration changes
- payout approvals
- permission-sensitive operations
- audit-sensitive access

Not every admin needs every power; use capability-based controls.

## Core Playbooks To Maintain

### Expert onboarding review

Should cover:

- what to verify
- what blocks approval
- what evidence is required
- who can approve
- what gets logged

### Booking issue support

Should cover:

- locating the booking/session
- checking reminders, payment state, and calendar sync state
- escalation path if customer/expert impact is active

### Payment and payout review

Should cover:

- payment verification
- refund handling
- payout eligibility review
- payout approval process
- when escalation is required

### Transcript / AI report issue handling

Should cover:

- checking transcript availability
- checking AI generation state
- distinguishing transient failures from policy failures
- when manual intervention is allowed

### Diary sharing / visibility support

Should cover:

- how to verify a share permission
- how to reason about why an expert can or cannot see data
- when support can act and when the user must act

### Permission and membership support

Should cover:

- adding/removing organization access
- role change workflow
- required audit records
- when elevated approval is required

## Sensitive Actions That Require Extra Care

The team should explicitly document higher-risk actions such as:

- payout approval
- permission changes
- access to sensitive data views
- export generation
- account-level recovery or intervention

These should include:

- who can perform them
- preconditions
- audit expectation
- rollback or correction path

## Operational Escalation

Every playbook should define:

- first responder
- escalation owner
- blocking severity thresholds
- when engineering must be involved

## Recommended Playbook Format

Each playbook should include:

- purpose
- who can perform it
- inputs needed
- step-by-step process
- safety checks
- audit/logging expectations
- escalation path

## Related Docs

- [`identity-rbac-spec.md`](./identity-rbac-spec.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
- [`integration-runbooks.md`](./integration-runbooks.md)
- [`security-hardening-checklist.md`](./security-hardening-checklist.md)
