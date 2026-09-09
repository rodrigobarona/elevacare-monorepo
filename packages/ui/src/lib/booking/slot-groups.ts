export type FunnelSlot = {
  start: string
  end: string
}

export type DaySlots = {
  dateKey: string
  slots: FunnelSlot[]
}

export function dateKeyInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

export function groupSlotsByDay(
  slots: readonly FunnelSlot[],
  timeZone: string
): DaySlots[] {
  const groups = new Map<string, FunnelSlot[]>()
  for (const slot of slots) {
    const key = dateKeyInZone(slot.start, timeZone)
    const existing = groups.get(key) ?? []
    existing.push(slot)
    groups.set(key, existing)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, daySlots]) => ({
      dateKey,
      slots: [...daySlots].sort((a, b) => a.start.localeCompare(b.start)),
    }))
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)
  )
}

export function calendarDays(month: Date): Date[] {
  const first = startOfMonth(month)
  const weekday = first.getUTCDay()
  const lead = weekday === 0 ? 6 : weekday - 1
  const days: Date[] = []
  for (let i = -lead; i < 42 - lead; i++) {
    days.push(
      new Date(
        Date.UTC(
          first.getUTCFullYear(),
          first.getUTCMonth(),
          first.getUTCDate() + i
        )
      )
    )
  }
  return days
}

export function sameUtcMonth(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth()
  )
}

export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
