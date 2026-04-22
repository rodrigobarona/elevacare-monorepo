# Eleva.care v3 CRM Spec

Status: Living

## Purpose

This document defines the CRM direction for Eleva.care v3.

The CRM in Eleva is not a separate sales tool. It is an expert-facing relationship layer that helps experts and organizations manage ongoing customer/patient engagement.

It should guide:

- expert workspace design
- customer history and relationship views
- follow-up workflows
- segmentation and lifecycle communication
- integration with scheduling, reports, and diary data

## CRM Principles

- The CRM should be customer-centric, not only booking-centric.
- Experts need a longitudinal view of the relationship, not just isolated sessions.
- CRM should be native to Eleva, not a disconnected external system.
- Sensitive information access must respect explicit visibility and consent.
- Email audiences and lifecycle messaging can integrate with Resend, but CRM remains an Eleva domain.

## Core CRM Goals

Experts should be able to:

- understand the history of each customer/patient
- see past and upcoming sessions
- review notes, reports, and relevant shared data
- create follow-up reminders
- suggest new appointments
- segment their customer base
- run lightweight lifecycle outreach

## CRM Core Entities

### Contact / Customer Record

Represents the expert-facing relationship view of a patient/customer.

Should include:

- identity summary
- relationship status
- assigned expert/org context
- upcoming sessions
- past sessions
- communication preferences
- visibility markers for shared data

### Relationship Status

Examples:

- new lead
- active
- follow_up_due
- inactive
- completed_program

### Segment / Audience

Represents reusable customer groupings.

Examples:

- first session completed
- no booking in 60 days
- active pack holders
- postpartum program participants

### Follow-Up Task

Represents a future action to take.

Examples:

- remind in 2 months
- send care plan
- recommend follow-up appointment

### Suggested Appointment

Represents an expert-initiated recommendation for the customer to confirm.

## CRM Views Experts Need

### Customer profile view

Should show:

- person summary
- session timeline
- active products/subscriptions/packs
- latest notes/reports
- latest shared diary data where allowed
- reminders and tasks

### Customer list / pipeline view

Should support:

- filtering
- sorting
- segment views
- next action visibility

### Follow-up center

Should support:

- due tasks
- overdue tasks
- suggested rebooking
- communications pending

## CRM And Scheduling Relationship

The CRM should be deeply connected to scheduling.

Examples:

- a missed follow-up should appear in CRM
- expert-suggested appointments should flow into booking
- rebooking logic should use session history

CRM should not reinvent booking state. It should use booking/session data and add relationship context on top.

## CRM And Documents/Reports

The CRM should provide structured access to:

- reports that are visible to the expert/customer in context
- uploaded documents
- notes metadata
- shared diary data visibility

The CRM should not break consent boundaries just because it aims to be convenient.

## CRM And Resend

Resend audiences and automation can be useful for:

- segmentation-based email communication
- lightweight lifecycle campaigns
- follow-up email journeys

But Eleva should remain the source of truth for:

- who a contact is
- what the current relationship state is
- which data can be used
- whether a message should be sent at all

## Initial CRM Scope

The first build should support:

- customer record page
- session history
- upcoming session visibility
- notes/reports access in context
- follow-up reminders/tasks
- suggested appointments
- basic segmentation

## Deferred CRM Scope

Later phases may add:

- advanced pipeline boards
- bulk actions
- advanced campaign logic
- richer automation orchestration
- organization-wide CRM views across multiple experts

## Consent And Visibility

The CRM must respect:

- role permissions
- organization context
- shared-data permissions
- diary/transcript/report visibility rules

CRM convenience must never override privacy boundaries.

## Open Questions

- what relationship statuses are required at launch
- how much segmentation is v1 versus later
- whether organization-level CRM views are launch-critical
- how much outreach automation should be built into Eleva versus delegated to Resend

## Related Docs

- [`domain-model.md`](./domain-model.md)
- [`notifications-spec.md`](./notifications-spec.md)
- [`mobile-integration-spec.md`](./mobile-integration-spec.md)
- [`ai-reporting-spec.md`](./ai-reporting-spec.md)
