# Eleva.care v3 Security Hardening Checklist

Status: Living

## Purpose

This document is a practical checklist for hardening Eleva.care v3 during implementation and before launch.

It complements the broader architecture and compliance docs by translating them into concrete engineering checks.

## How To Use This Checklist

Use this:

- during implementation of high-risk systems
- before merging major platform features
- during launch readiness reviews
- during security/compliance review cycles

## Identity And Access

- [ ] Authentication uses the approved shared identity model.
- [ ] Capability-based RBAC is enforced server-side.
- [ ] Sensitive routes and actions require explicit authorization checks.
- [ ] Organization/workspace context is validated on sensitive operations.
- [ ] Membership/permission changes are auditable.

## Sensitive Data Handling

- [ ] Sensitive content is not placed in URLs.
- [ ] Sensitive content is not exposed to generic client logs.
- [ ] Sensitive content is not casually serialized into observability tools.
- [ ] Visibility rules for diary, transcripts, notes, reports, and documents are enforced before response serialization.
- [ ] Data access to high-sensitivity artifacts is auditable.

## API And Webhooks

- [ ] All inbound webhook providers are verified/authenticated.
- [ ] Idempotency is enforced for payment, booking, and transcript workflows.
- [ ] API inputs are validated with explicit schemas.
- [ ] Error payloads do not leak internal or sensitive content.
- [ ] Public endpoints return only intentionally exposed fields.

## Scheduling And Calendars

- [ ] Calendar tokens/credentials are handled as sensitive integration data.
- [ ] Availability calculations do not trust client input as the source of truth.
- [ ] Slot reservation conflicts are handled server-side.
- [ ] Booking state transitions are protected against race conditions and replay.

## Payments And Payouts

- [ ] Payment and payout processing is idempotent.
- [ ] Commission and payout approval actions are auditable.
- [ ] Refund and payout operations require appropriate permissions.
- [ ] Billing metadata does not expose more sensitive detail than needed.

## Notifications

- [ ] Email/SMS bodies do not include unnecessary sensitive content.
- [ ] Notification preferences are respected where applicable.
- [ ] In-app notifications do not overexpose sensitive material.
- [ ] Reminder links are session-aware and safe.

## AI And Transcript Flows

- [ ] Only authorized inputs are used in AI generation.
- [ ] AI outputs are treated as drafts until approved where policy requires.
- [ ] Transcript and AI artifacts follow explicit retention and visibility rules.
- [ ] AI metadata is observable without leaking raw sensitive payloads broadly.

## Mobile And Sharing

- [ ] Diary data defaults are privacy-safe.
- [ ] Expert visibility requires explicit share/visibility rules.
- [ ] Mobile sync does not create a second security model.
- [ ] Mobile API payloads are minimized by audience.

## Platform And Infrastructure

- [ ] Environments are clearly separated.
- [ ] Secrets management is centralized and not copied casually into app code or local docs.
- [ ] Security headers are configured for public/product surfaces.
- [ ] Dependency updates and vulnerability review are part of the operating process.
- [ ] Operational logs use structured, redacted metadata.

## Launch Readiness

- [ ] High-risk workflows have runbooks.
- [ ] Incident escalation and ownership are defined.
- [ ] Core integrations have failure handling and observability.
- [ ] Admin/operator surfaces have least-privilege review.
- [ ] Security-sensitive assumptions are documented in ADRs/specs.

## Related Docs

- [`identity-rbac-spec.md`](./identity-rbac-spec.md)
- [`compliance-data-governance.md`](./compliance-data-governance.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
- [`calendar-integration-spec.md`](./calendar-integration-spec.md)
