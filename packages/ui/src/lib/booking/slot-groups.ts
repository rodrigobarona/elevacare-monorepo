export type FunnelSlot = {
  start: string
  end: string
}

export type DaySlots = {
  dateKey: string
  slots: FunnelSlot[]
}

export type DayPart = "morning" | "afternoon" | "evening"

export type DayPartSlots = {
  part: DayPart
  slots: FunnelSlot[]
}

export function dateKeyInZone(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso))
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )
  return `${values.year}-${values.month}-${values.day}`
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

/** Before 12:00 is morning, before 17:00 afternoon, then evening. */
export function dayPartInZone(iso: string, timeZone: string): DayPart {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso))
  )
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}

/** One day's times split into Morning / Afternoon / Evening, in order. */
export function groupSlotsByDayPart(
  slots: readonly FunnelSlot[],
  timeZone: string
): DayPartSlots[] {
  const order: DayPart[] = ["morning", "afternoon", "evening"]
  const byPart = new Map<DayPart, FunnelSlot[]>()
  for (const slot of [...slots].sort((a, b) =>
    a.start.localeCompare(b.start)
  )) {
    const part = dayPartInZone(slot.start, timeZone)
    byPart.set(part, [...(byPart.get(part) ?? []), slot])
  }
  return order.flatMap((part) => {
    const partSlots = byPart.get(part)
    return partSlots ? [{ part, slots: partSlots }] : []
  })
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)
  )
}

/** The UTC month start holding a civil date key such as "2026-11-09". */
export function monthOfDateKey(dateKey: string): Date {
  const [year, month] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1))
}

/** "Europe/Lisbon" → "Lisbon", "America/Sao_Paulo" → "Sao Paulo". */
export function zoneCity(timeZone: string): string {
  const last = timeZone.split("/").pop() ?? timeZone
  return last.replaceAll("_", " ")
}

/** "UTC+01:00" style offset of a zone at a given instant. */
export function zoneOffsetLabel(timeZone: string, at: Date): string {
  const name =
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      timeZoneName: "longOffset",
    })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT"
  // "GMT" alone means +00:00.
  return name === "GMT" ? "UTC+00:00" : name.replace("GMT", "UTC")
}
