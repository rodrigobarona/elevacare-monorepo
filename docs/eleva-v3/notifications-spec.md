# Eleva.care v3 Notifications Spec

Status: Living

## Purpose

This document defines the notification architecture for Eleva.care v3.

It should guide:

- email, SMS, and in-app messaging
- event-triggered lifecycle communication
- reminders and operational notifications
- notification preferences
- channel ownership decisions

## Notification Principles

- Notification intent should be modeled separately from channel delivery.
- The system should support email, SMS, and in-app as distinct channels.
- Sensitive data should not leak into notification payloads.
- Customer-facing and expert-facing notifications should share a consistent event model.
- Resend can power email and audience automation, but it should not become the entire notification architecture.

## Channel Strategy

### Email

Primary channel for:

- account activation
- booking confirmation
- reminders
- receipts/invoices where appropriate
- post-session follow-up
- lifecycle messaging

Provider:

- Resend

### SMS

Secondary but important channel for:

- high-urgency reminders
- day-of-session prompts
- rebooking nudges where appropriate

SMS should remain optional at launch if scope requires phasing, but the domain model should be ready for it.

### In-app notifications

Required for:

- dashboard alerts
- expert tasks and follow-ups
- reminders and status changes
- patient updates that should persist in the product

This should be a first-class Eleva system, not replaced by email automation tools.

## Notification Model

### Notification Intent

Represents what happened and why a message should exist.

Examples:

- booking_confirmed
- reminder_24h
- reminder_1h
- session_cancelled
- payout_approved
- expert_follow_up_due
- diary_share_received

### Delivery Attempt

Represents an attempt to deliver through a specific channel.

Examples:

- email delivery
- SMS delivery
- in-app creation

### Recipient Preference

Represents the user's allowed channels and preference settings.

Examples:

- marketing email opt-in
- booking reminders by SMS
- in-app only for certain updates

## Recommended Notification Categories

### Transactional

- sign in / activation
- booking confirmation
- payment confirmation
- receipts
- reschedule/cancel confirmations

### Reminder

- 24h before session
- 1h before session
- expert-defined follow-up reminders
- diary completion reminders

### Operational

- payout status
- expert onboarding review
- admin actions requiring follow-up

### Lifecycle / CRM

- rebook suggestions
- expert outreach
- audience-based communication

## Ownership By System

### Eleva domain/event layer

Owns:

- notification intents
- business rules
- recipient resolution
- preference checks
- audit-sensitive notification decisions

### Channel providers

Own:

- final transport
- delivery metadata
- retries within channel-specific constraints

## Resend Role

Resend is a good fit for:

- transactional email
- React Email templates
- audiences and email-oriented automation
- delivery webhooks

Resend is not enough alone for:

- in-app notification center
- cross-channel preference logic
- all future real-time communication needs

## Suggested Initial Event Catalog

The first build should support at least:

- account_activated
- booking_confirmed
- booking_payment_failed
- booking_rescheduled
- booking_cancelled
- reminder_24h
- reminder_1h
- session_completed
- report_available
- payout_eligible
- payout_approved
- suggested_follow_up_created
- diary_share_visible_to_expert

## Preference Model

The system should support preferences per:

- channel
- category
- role/context where relevant

At minimum:

- transactional notifications should not be turned off when they are operationally required
- marketing/lifecycle preferences should be separate
- SMS consent should be explicit

## In-App Notification Center

The authenticated product should include an in-app notification center that supports:

- unread/read state
- links to the relevant object or page
- role-specific views
- persistence beyond email inbox behavior

## Security And Compliance

Notifications must not expose unnecessary sensitive information.

Examples:

- do not include transcript content in notifications
- do not include sensitive health data in email/SMS bodies by default
- keep links secure and session-aware

The system should log:

- intent creation
- channel selection
- send attempts
- critical failures for operational notifications

## Open Questions

- whether SMS is launch-critical
- first launch set of in-app notifications
- whether experts can create custom reminder templates
- how much CRM/lifecycle messaging belongs in v1 versus phase 2

## Related Docs

- [`payments-payouts-spec.md`](./payments-payouts-spec.md)
- [`crm-spec.md`](./crm-spec.md)
- [`mobile-integration-spec.md`](./mobile-integration-spec.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
