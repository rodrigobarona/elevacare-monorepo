export type FunnelSlot = {
  start: string
  end: string
}

export type DaySlots = {
  dateKey: string
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

/** "2026-11-30" + 2 → "2026-12-02" (civil dates, no time zone). */
export function addDaysToKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days))
    .toISOString()
    .slice(0, 10)
}

/** "Europe/Lisbon" → "Lisbon", "America/Sao_Paulo" → "Sao Paulo". */
/** City names that differ from the IANA spelling, by language. */
const LOCAL_CITY_NAMES: Record<string, Partial<Record<string, string>>> = {
  "Europe/Lisbon": { pt: "Lisboa", es: "Lisboa" },
  "Atlantic/Azores": { pt: "Açores", es: "Azores" },
  "Atlantic/Canary": { pt: "Canárias", es: "Canarias" },
  "Europe/London": { pt: "Londres", es: "Londres" },
  "Europe/Paris": { es: "París" },
  "Europe/Berlin": { pt: "Berlim", es: "Berlín" },
  "Europe/Brussels": { pt: "Bruxelas", es: "Bruselas" },
  "Europe/Rome": { pt: "Roma", es: "Roma" },
  "Europe/Zurich": { pt: "Zurique", es: "Zúrich" },
  "America/Sao_Paulo": { pt: "São Paulo", es: "São Paulo" },
}

/** "Lisbon" (or "Lisboa" in Portuguese) from "Europe/Lisbon". */
export function zoneCity(timeZone: string, locale?: string): string {
  const language = locale?.split("-")[0]
  const local = language ? LOCAL_CITY_NAMES[timeZone]?.[language] : undefined
  if (local) return local
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
