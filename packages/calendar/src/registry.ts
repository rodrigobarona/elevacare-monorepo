import type { CalendarAdapter, CalendarProvider } from "./types"
import { GoogleCalendarAdapter } from "./adapters/google"
import { MicrosoftCalendarAdapter } from "./adapters/microsoft"

const adapters: Record<CalendarProvider, CalendarAdapter> = {
  google: new GoogleCalendarAdapter(),
  microsoft: new MicrosoftCalendarAdapter(),
}

export function getAdapter(provider: CalendarProvider): CalendarAdapter {
  const adapter = adapters[provider]
  if (!adapter) throw new Error(`Unknown calendar provider: ${provider}`)
  return adapter
}

const SLUG_TO_PROVIDER: Record<string, CalendarProvider> = {
  "google-calendar": "google",
  "microsoft-calendar": "microsoft",
}

export function calendarProviderForSlug(slug: string): CalendarProvider | null {
  return Object.hasOwn(SLUG_TO_PROVIDER, slug) ? SLUG_TO_PROVIDER[slug]! : null
}
