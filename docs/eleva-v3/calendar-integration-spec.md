# Eleva.care v3 Calendar Integration Spec

Status: Living

## Purpose

This document defines how calendar integrations should work in Eleva.care v3.

It should guide:

- provider integration choices
- busy-time and destination-calendar modeling
- booking synchronization
- expert setup UX

## Core Decision

Eleva should own its calendar integration layer.

That means Eleva should not assume calendar sync belongs to WorkOS or another identity-layer abstraction.

The scheduling platform should treat calendar connections as part of `packages/scheduling` and related service boundaries.

## Integration Principles

- Separate authentication from calendar-sync responsibilities.
- Separate busy-time detection from destination-calendar writing.
- Keep provider-specific logic behind Eleva abstractions.
- Make sync behavior explicit and observable.

## Initial Provider Targets

The initial providers should likely be:

- Google Calendar
- Microsoft Outlook calendar

These are the highest-value integrations for expert scheduling.

## Core Calendar Concepts

### Connected calendar account

Represents the external calendar connection.

### Busy calendar selection

Represents which calendars should block availability.

### Destination calendar

Represents where confirmed Eleva sessions should be written.

These must be treated as separate concepts.

## Why This Separation Matters

An expert may want:

- multiple calendars to be checked for conflicts
- one specific calendar to receive confirmed bookings

If Eleva collapses these into one concept, the scheduling model becomes too rigid.

## Expert Setup Requirements

The expert setup flow should support:

- connect one or more calendars
- choose which calendars block availability
- choose a destination calendar
- review sync status
- reconnect/re-authorize when needed

## Booking Sync Flow

Recommended model:

1. expert configures calendars
2. Eleva computes availability using selected busy calendars plus internal bookings
3. customer books a slot
4. Eleva confirms the booking
5. Eleva writes the session to the destination calendar

## Internal Source Of Truth

Eleva's booking/session model must remain the source of truth for Eleva bookings.

Calendar providers should be treated as:

- busy-time inputs
- destination sync targets

not as the authoritative source of the Eleva domain state.

## Error Handling

The system should handle:

- expired credentials
- sync failures
- destination write failures
- provider unavailability

These must be observable and surfaced appropriately to experts/admins.

## Security And Storage

Calendar credentials/tokens should be handled as sensitive integration data.

The system should clearly define:

- where secrets/tokens live
- how access is limited
- how reconnection flows work

## Future Extensions

The model should leave room for:

- event-level calendar rules
- organization-managed calendar defaults
- clinic/team calendar behavior

But MVP should remain focused and simple.

## Open Questions

- exact provider onboarding UX
- whether event-level destination calendars are needed at launch
- exact reconnect/re-auth flow
- whether any sync-back behavior is needed later

## Related Docs

- [`scheduling-booking-spec.md`](./scheduling-booking-spec.md)
- [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md)
- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
