/**
 * Destination calendar resolution for confirmed bookings.
 *
 * Precedence (Phase 04B / ADR-004):
 *   1. event_type_modes destination override
 *   2. event_types destination override
 *   3. calendar_destinations expert default
 *   4. null → ICS e-mail fallback (Phase 08)
 */

export type CalendarDestinationRef = {
  expertIntegrationId: string
  externalCalendarId: string
}

export type DestinationOverrideInput = {
  destinationIntegrationId: string | null
  destinationExternalCalendarId: string | null
}

function asRef(
  override: DestinationOverrideInput | null | undefined
): CalendarDestinationRef | null {
  if (
    !override?.destinationIntegrationId ||
    !override.destinationExternalCalendarId
  ) {
    return null
  }
  return {
    expertIntegrationId: override.destinationIntegrationId,
    externalCalendarId: override.destinationExternalCalendarId,
  }
}

/**
 * Pure precedence resolver. Callers load overrides + expert default from DB.
 */
export function resolveCalendarDestination(input: {
  modeOverride?: DestinationOverrideInput | null
  eventTypeOverride?: DestinationOverrideInput | null
  expertDefault?: CalendarDestinationRef | null
}): CalendarDestinationRef | null {
  return (
    asRef(input.modeOverride) ??
    asRef(input.eventTypeOverride) ??
    input.expertDefault ??
    null
  )
}
