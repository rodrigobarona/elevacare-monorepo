/**
 * The host of a subscribed (iCal) calendar. Its name is often the feed URL,
 * which carries a private token, so it is never shown in full.
 */
const FEED_URL = /^(https?|webcal):\/\//i

export function importedCalendarHost(name: string): string | null {
  if (!FEED_URL.test(name.trim())) return null
  try {
    const url = new URL(name.trim().replace(/^webcal:/i, "https:"))
    return url.hostname.replace(/^www\./, "") || null
  } catch {
    return null
  }
}

/**
 * What the expert reads for a calendar. Google names the main calendar after
 * the account email (already in the card header), and Outlook calls it
 * "Calendar", so the main one is always "Main calendar".
 */
export function calendarDisplayName(
  calendar: { name: string; primary: boolean },
  labels: {
    main: string
    imported: (host: string) => string
    importedUnknown: string
  }
): string {
  if (calendar.primary) return labels.main
  const host = importedCalendarHost(calendar.name)
  if (host) return labels.imported(host)
  // A feed URL we can't read still carries its token: never show it.
  if (FEED_URL.test(calendar.name.trim())) return labels.importedUnknown
  return calendar.name
}
