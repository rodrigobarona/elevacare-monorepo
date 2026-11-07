export type SessionMode = "online" | "in_person" | "phone"

export type UpcomingModeSlots = {
  eventSlug: string
  modeId: string
  mode: SessionMode
  locationLabel: string | null
  starts: string[]
}

export type UpcomingSlot = {
  modeId: string
  mode: SessionMode
  locationLabel: string | null
  start: string
}

const DEFAULT_MAX_SLOTS = 6

/**
 * The profile booking card's next times for one service: every mode's open
 * starts merged, soonest first. A start offered by two modes stays twice,
 * because the member books a time and a way to meet together.
 */
export function pickServiceSlots(
  modes: readonly UpcomingModeSlots[],
  eventSlug: string,
  maxSlots = DEFAULT_MAX_SLOTS
): UpcomingSlot[] {
  return modes
    .filter((mode) => mode.eventSlug === eventSlug)
    .flatMap((mode) =>
      mode.starts.map((start) => ({
        modeId: mode.modeId,
        mode: mode.mode,
        locationLabel: mode.locationLabel,
        start,
      }))
    )
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, maxSlots)
}
