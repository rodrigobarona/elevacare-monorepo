# Eleva Diary Mobile Integration Spec

Status: Authoritative

## Purpose

This document defines how `Eleva Diary`, the first Eleva mobile app, should fit into the Eleva.care v3 platform.

It should guide:

- monorepo planning
- auth and API design
- diary-data modeling
- consent and sharing flows
- patient and expert experience design

## Decision Summary

`Eleva Diary` is part of the same monorepo as Eleva.care v3 (see ADR-010).

**Concrete merge trigger**: bring `apps/diary-mobile` + `packages/mobile` into the repo once **all four** of these have shipped v1 contracts:

- `packages/auth`
- `packages/db`
- `apps/api`
- `packages/notifications`

This sits in milestone M7 of the roadmap.

Merging before that = API drift, inconsistent auth/account models, duplicated validation, inconsistent privacy/consent behavior. Merging after that = stable contracts, shared types, same identity model, same consent boundary.

## Product Role

`Eleva Diary` is not a separate product universe.
It is a patient companion application within the Eleva platform.

Its role is to help patients:

- capture longitudinal health data
- follow expert-recommended tracking routines
- stay engaged between sessions
- share useful data with experts when they choose to

Its role is to help experts:

- recommend structured tracking
- review shared diary patterns
- use the data in care, coaching, tutoring, or follow-up workflows

## Monorepo Placement

Recommended location:

- `apps/diary-mobile`

Recommended shared dependencies:

- `packages/auth`
- `packages/config`
- `packages/mobile`
- validation and DTO contracts derived from platform packages

The mobile app should consume shared contracts rather than invent its own backend shape.

## Recommended Integration Timing

### Not day one

Do not make the mobile app part of the first foundation milestone.

Reason:

- the first milestone should stabilize auth, tenancy, API boundaries, and the core domain model

### Early after contracts stabilize

Bring it into the monorepo once these exist:

- stable auth/session contract
- stable user/account model
- stable API boundary for patient data
- stable validation and serialization rules

That is the right moment to merge mobile without causing excessive churn.

## Core Mobile Use Cases

The first mobile app should support:

- diary entry capture
- symptom and event tracking
- structured question sets/templates
- reminders and engagement prompts
- account sign-in linked to Eleva
- visibility into what is private vs shared
- one-click sharing to the expert when appropriate

## Shared Data Model

The mobile app should create and work with:

- diary entries
- diary templates
- symptom/event logs
- attachments where allowed
- derived summaries
- visibility and consent records

These should be modeled as first-class Eleva domain entities, not mobile-only side tables with incompatible semantics.

## Auth Model

The mobile app should use the same identity and account model as Eleva.care.

That means:

- same user identity
- same guest-to-account activation path where relevant
- same patient/customer profile
- same access and consent rules

The mobile app must not create a second parallel identity model.

## Recommended Sharing Model

Default recommendation:

- private by default
- synced to the user's Eleva account
- explicit sharing required for expert visibility

This means:

- the patient owns the data by default
- the data can appear in the patient's own dashboard/history
- the expert only sees it when the patient has granted visibility

This is the safest starting point because it balances:

- patient trust
- expert usefulness
- compliance clarity
- product flexibility

## Visibility Levels

The system should support explicit visibility choices such as:

- private to patient only
- shared with one expert
- shared with one organization/workspace
- shared for a defined time window

The exact product UX can evolve, but the domain model should support this explicitly.

## Expert Workflows

Experts should be able to:

- recommend the mobile diary to a patient
- suggest a template or tracking plan
- see shared diary data in Eleva when permission exists
- use shared diary data during follow-up, reports, and CRM workflows

Experts should not automatically see all diary data by default.

## Patient Workflows

Patients should be able to:

- capture entries in mobile
- see diary history in mobile
- review what is shared and with whom
- revoke or change visibility where allowed by policy
- access shared summaries from the Eleva dashboard

## Sync Strategy

Recommended initial approach:

- sync diary data to Eleva platform storage
- gate expert visibility behind explicit consent/share records
- expose the same data to the patient's dashboard account

This is better than:

- mobile-only local storage forever
- expert-visible by default
- one-off exports with no persistent model

## Notification Integration

The mobile app reuses the platform notification Lane 1 model via **Expo push** (see notifications-spec):

- reminders to complete diary entries
- session-related tracking prompts
- follow-up plans
- rebooking nudges
- `diary_share_visible_to_expert` when a share is granted

Notification preferences are part of the shared Eleva preference model (`notification_preferences`), not a separate mobile-only system. Quiet hours and per-kind consent honored.

## Compliance And Data Governance

Because diary data may be sensitive, the system must define:

- lawful basis and consent handling
- access logs for expert visibility
- retention policy
- export/delete behavior
- AI usage rules if summaries are generated from diary data

If diary data is used for AI summaries or reports, that must be explicitly governed and auditable.

## What The Mobile App Should Not Do Initially

- invent a separate backend
- implement a second account system
- bypass platform consent rules
- expose diary data to experts automatically
- create mobile-only business rules that cannot be understood in the web dashboard

## Sharing Model (Locked — ADR-010)

Three visibility states per entry (or per range):

1. **Private** (default) — only the patient sees it
2. **Synced to Eleva account** — available in patient dashboard but not shared with any expert
3. **Shared with a specific expert** — explicit consent grant, time-bounded, revocable, audited

Never blanket "all experts" sharing.

Consent grants: `diary_share(patient_id, expert_id, start_date, end_date, granted_at, revoked_at, audit_ref)`.

Rollout: behind `ff.diary_share`.

## Closed Decisions

- Merge trigger locked: M7, after v1 contracts of `auth` + `db` + `api` + `notifications`
- Push via Expo through Lane 1 `sendNotification`
- Consent-gated sharing, never default-on
- AI pipeline respects share windows strictly (ADR-009)

## Open Questions

- what exact diary templates launch first
- whether offline-first is required at M7 or follow-up
- whether diary attachments are launch-critical
- final default for "synced to account" vs "private" on new entries

## Related Docs

- [`master-architecture.md`](./master-architecture.md)
- [`monorepo-structure.md`](./monorepo-structure.md)
- [`domain-model.md`](./domain-model.md)
- [`notifications-spec.md`](./notifications-spec.md)
- [`ai-reporting-spec.md`](./ai-reporting-spec.md)
- [`compliance-data-governance.md`](./compliance-data-governance.md)
- [`adrs/README.md`](./adrs/README.md) (ADR-010 Mobile Sync Model)
