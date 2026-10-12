export type UpcomingModeSlots = {
  eventSlug: string
  eventTitle: string
  modeId: string
  mode: "online" | "in_person" | "phone"
  locationLabel: string | null
  starts: string[]
}

export type UpcomingSlotRow = {
  eventSlug: string
  eventTitle: string
  modeId: string
  mode: "online" | "in_person" | "phone"
  locationLabel: string | null
  start: string
}

const DEFAULT_MIN_FILL = 3
const DEFAULT_MAX_ROWS = 6

function startMs(iso: string): number {
  return Date.parse(iso)
}

function toRow(mode: UpcomingModeSlots, start: string): UpcomingSlotRow {
  return {
    eventSlug: mode.eventSlug,
    eventTitle: mode.eventTitle,
    modeId: mode.modeId,
    mode: mode.mode,
    locationLabel: mode.locationLabel,
    start,
  }
}

/**
 * Profile shortcuts: at least one soonest slot per offer when several
 * exist. A single-offer profile still fills extra times up to `minFill`.
 */
export function pickUpcomingSlotRows(
  modes: readonly UpcomingModeSlots[],
  options?: { minFill?: number; maxRows?: number }
): UpcomingSlotRow[] {
  const minFill = options?.minFill ?? DEFAULT_MIN_FILL
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS

  const byEvent = new Map<string, UpcomingModeSlots[]>()
  for (const mode of modes) {
    const group = byEvent.get(mode.eventSlug) ?? []
    group.push(mode)
    byEvent.set(mode.eventSlug, group)
  }

  const onePerEvent: UpcomingSlotRow[] = []
  for (const group of byEvent.values()) {
    let best: UpcomingSlotRow | null = null
    for (const mode of group) {
      const start = mode.starts[0]
      if (!start) continue
      if (!best || startMs(start) < startMs(best.start)) {
        best = toRow(mode, start)
      }
    }
    if (best) onePerEvent.push(best)
  }

  onePerEvent.sort((a, b) => startMs(a.start) - startMs(b.start))
  const chosen = onePerEvent[0]
  if (!chosen) return []
  if (onePerEvent.length > 1) return onePerEvent.slice(0, maxRows)

  const rows = [chosen]
  const usedStarts = new Set([chosen.start])
  const group = byEvent.get(chosen.eventSlug) ?? []
  const preferred = [
    ...group.filter((mode) => mode.modeId === chosen.modeId),
    ...group.filter((mode) => mode.modeId !== chosen.modeId),
  ]
  for (const mode of preferred) {
    for (const start of mode.starts) {
      if (usedStarts.has(start)) continue
      rows.push(toRow(mode, start))
      usedStarts.add(start)
      if (rows.length >= minFill) return rows
    }
  }
  return rows
}
