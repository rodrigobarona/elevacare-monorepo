const MODE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type BookingSelectionQuery = {
  mode?: string | string[]
  start?: string | string[]
}

export type BookingSelection = {
  modeId: string
  start: string
}

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? ""
  return value?.trim() ?? ""
}

export function sameSlotInstant(left: string, right: string): boolean {
  if (left === right) return true
  const leftMs = Date.parse(left)
  const rightMs = Date.parse(right)
  return Number.isFinite(leftMs) && leftMs === rightMs
}

export function parseBookingSelection(
  query: BookingSelectionQuery
): BookingSelection | null {
  const modeId = firstString(query.mode)
  const start = firstString(query.start)
  if (!MODE_ID_RE.test(modeId)) return null
  if (!Number.isFinite(Date.parse(start))) return null
  return { modeId, start }
}

export function bookingSelectionHref(
  username: string,
  eventSlug: string,
  selection: BookingSelection
): string {
  const params = new URLSearchParams({
    mode: selection.modeId,
    start: selection.start,
  })
  return `/${username}/${eventSlug}?${params.toString()}`
}
