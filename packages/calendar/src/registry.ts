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
