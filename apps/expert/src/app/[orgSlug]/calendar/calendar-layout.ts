/**
 * Where sessions sit in the week grid. Pure, and in the viewer's own time
 * zone: every function reads wall-clock time from `Date` (local getters),
 * so a session shows at the hour the expert's device says it is.
 */

export type TimedItem = { id: string; startsAt: string; endsAt: string }

export type HourRange = {
  /** First hour shown, 0 to 23. */
  start: number
  /** Hour the grid ends at, 1 to 24. */
  end: number
}

/** The working day shown when no session falls outside it. */
export const DEFAULT_HOURS: HourRange = { start: 7, end: 21 }

/** A block is never drawn shorter than this, so its time stays readable. */
export const MIN_BLOCK_MINUTES = 20

const DAY_MINUTES = 24 * 60

export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

type Span = { startMin: number; endMin: number }

/**
 * The part of a session that falls on `day`, in minutes from midnight, or
 * `null` when it does not touch that day. A session that crosses midnight
 * gives one span per day.
 */
export function spanOnDay(item: TimedItem, day: Date): Span | null {
  const start = new Date(item.startsAt)
  const end = new Date(item.endsAt)
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = addDays(dayStart, 1)
  if (!(start < dayEnd) || !(end > dayStart)) {
    // A session with no length still shows on the day it starts.
    if (!(end > start) && isSameDay(start, dayStart)) {
      const at = minutesFromMidnight(start)
      return { startMin: at, endMin: at }
    }
    return null
  }
  return {
    startMin: start < dayStart ? 0 : minutesFromMidnight(start),
    endMin: end >= dayEnd ? DAY_MINUTES : minutesFromMidnight(end),
  }
}

/**
 * Hours the grid shows: the working day, widened so that every session of
 * the week is inside it. Nothing booked is ever off the grid.
 */
export function visibleHours(
  items: TimedItem[],
  days: Date[],
  base: HourRange = DEFAULT_HOURS
): HourRange {
  let { start, end } = base
  for (const day of days) {
    for (const item of items) {
      const span = spanOnDay(item, day)
      if (!span) continue
      start = Math.min(start, Math.floor(span.startMin / 60))
      const drawnEnd = Math.min(
        DAY_MINUTES,
        Math.max(span.endMin, span.startMin + MIN_BLOCK_MINUTES)
      )
      end = Math.max(end, Math.ceil(drawnEnd / 60))
    }
  }
  return { start: Math.max(0, start), end: Math.min(24, end) }
}

export type DayBlock<T extends TimedItem> = {
  item: T
  /** Distance from the top of the day column, in percent. */
  topPct: number
  /** Height in percent of the day column. */
  heightPct: number
  /** Minutes the block stands for on this day (drawn, not booked). */
  drawnMinutes: number
  /** Side-by-side position among sessions that overlap: 0 is leftmost. */
  lane: number
  /** How many lanes its group of overlapping sessions uses. */
  lanes: number
  /** The session began on an earlier day. */
  continuesFromBefore: boolean
  /** The session goes on into the next day. */
  continuesAfter: boolean
}

/**
 * Blocks for one day column: each at its real start, as tall as it lasts,
 * and side by side when two overlap.
 */
export function layoutDay<T extends TimedItem>(
  items: T[],
  day: Date,
  hours: HourRange
): DayBlock<T>[] {
  const gridStart = hours.start * 60
  const gridEnd = hours.end * 60
  const gridMinutes = gridEnd - gridStart
  if (gridMinutes <= 0) return []

  const drawn = items
    .flatMap((item) => {
      const span = spanOnDay(item, day)
      if (!span) return []
      // Wholly outside the hours shown (the grid is normally widened first).
      if (span.startMin >= gridEnd) return []
      if (span.endMin <= gridStart && span.startMin < gridStart) return []
      const from = Math.max(span.startMin, gridStart)
      // Short sessions get a readable height; none runs past the grid.
      const to = Math.min(
        gridEnd,
        Math.max(span.endMin, from + MIN_BLOCK_MINUTES)
      )
      const top = Math.min(from, to - Math.min(MIN_BLOCK_MINUTES, gridMinutes))
      return [{ item, span, from: Math.max(gridStart, top), to }]
    })
    .sort(
      (a, b) =>
        a.from - b.from || b.to - a.to || a.item.id.localeCompare(b.item.id)
    )

  const blocks: DayBlock<T>[] = []
  // A group is a run of blocks that touch each other, directly or through
  // another block. Lanes are counted per group.
  let group: { block: DayBlock<T>; to: number }[] = []
  let groupEnd = -1
  const closeGroup = () => {
    const lanes = group.reduce((max, g) => Math.max(max, g.block.lane + 1), 0)
    for (const g of group) g.block.lanes = lanes
    group = []
  }

  for (const d of drawn) {
    if (group.length > 0 && d.from >= groupEnd) closeGroup()
    // First lane whose last block has ended.
    const laneEnds: number[] = []
    for (const g of group) {
      laneEnds[g.block.lane] = Math.max(laneEnds[g.block.lane] ?? 0, g.to)
    }
    let lane = laneEnds.findIndex((end) => end <= d.from)
    if (lane === -1) lane = laneEnds.length
    const block: DayBlock<T> = {
      item: d.item,
      topPct: ((d.from - gridStart) / gridMinutes) * 100,
      heightPct: ((d.to - d.from) / gridMinutes) * 100,
      drawnMinutes: d.to - d.from,
      lane,
      lanes: 1,
      continuesFromBefore:
        d.span.startMin === 0 && !isSameDay(new Date(d.item.startsAt), day),
      continuesAfter:
        d.span.endMin === DAY_MINUTES &&
        new Date(d.item.endsAt) > addDays(startOfDay(day), 1),
    }
    blocks.push(block)
    group.push({ block, to: d.to })
    groupEnd = Math.max(groupEnd, d.to)
  }
  closeGroup()
  return blocks
}

function startOfDay(day: Date): Date {
  const d = new Date(day)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Sessions of the week grouped by the day they start, days in order. */
export function agendaDays<T extends TimedItem>(
  items: T[],
  days: Date[]
): { day: Date; items: T[] }[] {
  return days
    .map((day) => ({
      day,
      items: items
        .filter((item) => isSameDay(new Date(item.startsAt), day))
        .sort(
          (a, b) =>
            Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
            a.id.localeCompare(b.id)
        ),
    }))
    .filter((entry) => entry.items.length > 0)
}

/**
 * Where "now" sits in the grid, in percent from the top, or `null` when
 * the current time is outside the hours shown.
 */
export function nowLinePct(now: Date, hours: HourRange): number | null {
  const minutes = minutesFromMidnight(now)
  const gridStart = hours.start * 60
  const gridEnd = hours.end * 60
  if (minutes < gridStart || minutes > gridEnd) return null
  return ((minutes - gridStart) / (gridEnd - gridStart)) * 100
}
