# Eleva.care v3 Domain Model

Status: Living

## Purpose

This document defines the canonical product/domain model for Eleva.care v3.

It exists to prevent the team from inventing different meanings for the same concepts across:

- web
- mobile
- API
- billing
- CRM
- scheduling
- admin tooling

This is not the final database schema. It is the product and architecture vocabulary that the schema should implement.

## Modeling Principles

- Prefer a single concept with multiple roles over duplicated role-specific models.
- Model consent and visibility explicitly for sensitive data.
- Keep expert, patient, organization, booking, and financial concepts separate.
- Support both healthcare and non-clinical expert types without rebuilding the platform.
- Treat mobile-generated data as first-class product data, not an afterthought.

## Core Identity And Tenancy

### User

Represents a single human identity in Eleva.

Examples:

- patient/customer
- expert
- organization admin
- Eleva operator

Notes:

- a user may hold multiple roles over time
- a user may be both patient and expert in different contexts
- a guest booking should still map to a future canonical user/account path

### Organization

Represents a tenant-like boundary.

Examples:

- patient personal organization
- expert personal organization
- clinic
- company/team
- future academy organization

Notes:

- organization is the main container for memberships, settings, and data isolation logic
- some users will effectively have a single-user organization

### Membership

Connects a user to an organization with a role/capability set.

Examples:

- patient member
- expert member
- org admin
- Eleva internal operator

### Role / Permission Grant

Represents capability-based authorization.

Examples:

- manage_schedule
- view_patient_shared_data
- approve_payout
- manage_org_members

## People And Profiles

### Expert Profile

Represents the expert-facing professional identity.

Contains:

- public listing data
- specialties
- languages
- country/license scope
- bio and trust signals
- onboarding status
- payout status
- availability readiness

Notes:

- must support clinicians and future non-clinical experts
- public profile and operational profile may be different views of the same expert

### Patient Profile

Represents the customer/patient-facing identity inside Eleva.

Contains:

- account basics
- preferences
- communication settings
- onboarding status
- relationship to experts and orgs

### Organization Profile

Represents public and internal identity of a clinic, company, or team.

Contains:

- display information
- billing settings
- seat settings
- org-level scheduling/payment rules

## Marketplace And Discovery

### Category

Represents a discovery taxonomy unit.

Examples:

- pelvic health
- mental health
- nutrition
- coaching
- education

### Specialty / Topic

Represents more precise expertise mapping.

Examples:

- postpartum recovery
- menopause support
- pediatric nutrition
- academic tutoring

### Expert Listing

Represents the public search/display shape of an expert.

Contains:

- headline
- profile card data
- marketplace filters
- next availability summary
- ratings and trust indicators

## Scheduling And Sessions

### Event Type

Represents a bookable service definition.

Examples:

- 60-minute consultation
- follow-up session
- intro call
- tutoring session
- coaching pack session

Contains:

- duration
- price
- booking rules
- language support
- mode
- visibility
- optional organization ownership

### Schedule

Represents a reusable availability setup.

Examples:

- weekday schedule
- summer schedule
- clinic-specific schedule

### Availability Rule

Represents recurring availability windows.

Examples:

- Mondays 09:00-13:00
- Wednesdays 14:00-18:00

### Date Override / Blocked Date

Represents exceptions to recurring availability.

Examples:

- holiday
- travel day
- manual time off

### Connected Calendar

Represents an external calendar account connection.

Examples:

- Google Calendar account
- Microsoft calendar account

### Busy Calendar Selection

Represents which connected calendars should block availability.

### Destination Calendar

Represents where Eleva should write confirmed events.

### Slot Reservation

Represents a temporary lock on a slot before booking confirmation/payment completion.

### Booking

Represents the commercial and scheduling commitment made by the customer.

Contains:

- selected event type
- selected time
- customer identity
- payment state
- booking state
- session linkage

### Session / Meeting

Represents the actual scheduled interaction.

Contains:

- date/time
- participants
- location mode
- calendar ids
- video session metadata
- reschedule/cancel history

### Session Location

Represents how the session happens.

Supported modes:

- online
- in person
- phone

For in-person mode, location data must be explicit and localizable.

## Clinical / Expert Workflow Data

### Session Note

Represents expert-authored notes about a session.

### Session Document

Represents an uploaded or attached document related to a session.

Examples:

- worksheet
- test result
- plan
- PDF attachment

### Session Report

Represents the expert-facing or patient-facing report produced after a session.

May be:

- manually written
- AI-drafted then expert reviewed

### Transcript Artifact

Represents transcript or transcript-derived data from video sessions.

Notes:

- must have clear consent and retention rules
- should not be treated as casual analytics data

## Billing And Finance

### Product

Represents the commercial item sold.

Examples:

- single session
- 10-session pack
- monthly subscription

### Price

Represents the monetized price configuration.

### Purchase

Represents the commercial transaction initiated by the customer.

### Pack

Represents a prepaid bundle of sessions or credits.

### Subscription

Represents a recurring customer or organization billing relationship.

### Invoice / Receipt

Represents customer-facing financial documentation.

### Commission Rule

Represents platform fee logic.

Examples:

- flat marketplace fee
- plan-based fee differences
- org-specific rules

### Payout

Represents money owed or transferred to an expert or organization.

### Payout Approval

Represents the controlled approval step before transfer.

## CRM And Lifecycle

### Contact / Customer Record

Represents the expert-facing customer relationship record.

Contains:

- basic identity
- relationship status
- past bookings
- reminders
- communication preferences

### Audience / Segment

Represents a reusable grouping for lifecycle messaging and CRM workflows.

### Reminder / Follow-Up Task

Represents a future action prompt.

Examples:

- rebook in 2 months
- send follow-up
- check after first session

### Suggested Appointment

Represents an expert-initiated recommendation for a future session.

### Rating / Review

Represents post-session trust and community feedback.

## Mobile And Tracked Data

### Diary Entry

Represents a patient-authored diary record created in `Eleva Diary`.

Examples:

- bladder diary entry
- symptom note
- habit log

### Diary Template / Question Set

Represents a structured tracking schema.

Examples:

- pelvic health diary
- hydration diary
- symptom tracker

### Metric / Symptom / Event Log

Represents structured measured or observed data.

Examples:

- symptom severity
- number of events
- duration
- free-text note

### Diary Attachment

Represents media or file linked to a diary entry.

### Share Permission / Consent Grant

Represents the patient decision to share diary data.

Examples:

- private only
- share with one expert
- share for one time window

### Visibility Window

Represents when and for whom tracked data is visible.

### Derived Summary / Trend Insight

Represents computed insight from diary data.

May be:

- system-generated summary
- AI-generated summary
- clinician/expert-reviewed summary

## State Boundaries That Must Be Modeled Explicitly

The implementation should explicitly model:

- guest -> registered user
- onboarding incomplete -> ready
- draft -> published expert listing
- slot reserved -> booked -> completed -> cancelled/rescheduled
- unpaid -> paid -> refundable -> settled
- payout pending -> eligible -> approved -> transferred
- private diary data -> shared diary data
- transcript available -> AI draft created -> expert reviewed -> patient-visible report

## Cross-Cutting Constraints

### Consent

Consent must be explicit wherever sensitive patient/customer data is:

- processed
- shared
- surfaced to experts
- used for AI drafting

### Auditability

These events must be auditable:

- access to shared patient data
- access to transcripts
- report generation
- payout approvals
- identity and permission changes

### Internationalization

The model should support:

- multiple content languages
- expert-supported languages
- localized event descriptions
- localized in-person location display

## Domain Questions Still Open

- exact modeling of guest users vs pre-created WorkOS identities
- final shape of organization hierarchy for clinics/teams
- pack/session-credit accounting model
- final visibility defaults for diary data
- how academy concepts map onto the same organization/user model

## Related Docs

- [`master-architecture.md`](./master-architecture.md)
- [`scheduling-booking-spec.md`](./scheduling-booking-spec.md)
- [`payments-payouts-spec.md`](./payments-payouts-spec.md)
- [`mobile-integration-spec.md`](./mobile-integration-spec.md)
