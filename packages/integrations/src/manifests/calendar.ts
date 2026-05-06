import type { IntegrationManifest } from "../types"
import { registerManifest } from "../registry"

const googleCalendar: IntegrationManifest = {
  slug: "google-calendar",
  category: "calendar",
  displayName: "Google Calendar",
  icon: "calendar",
  publisher: "Google",
  countries: [],
  connectType: "pipes",
  pipesProvider: "google-calendar",
  description: {
    en: "Sync your Google Calendar to check availability and create events for confirmed sessions.",
    pt: "Sincronize o seu Google Calendar para verificar disponibilidade e criar eventos para sessões confirmadas.",
    es: "Sincroniza tu Google Calendar para verificar disponibilidad y crear eventos para sesiones confirmadas.",
  },
  docsUrl: "https://support.google.com/calendar",
}

const microsoftCalendar: IntegrationManifest = {
  slug: "microsoft-calendar",
  category: "calendar",
  displayName: "Microsoft Calendar",
  icon: "calendar",
  publisher: "Microsoft",
  countries: [],
  connectType: "pipes",
  pipesProvider: "microsoft-outlook-calendar",
  description: {
    en: "Sync your Outlook/Microsoft 365 calendar to check availability and create events for confirmed sessions.",
    pt: "Sincronize o seu Outlook/Microsoft 365 para verificar disponibilidade e criar eventos para sessões confirmadas.",
    es: "Sincroniza tu Outlook/Microsoft 365 para verificar disponibilidad y crear eventos para sesiones confirmadas.",
  },
  docsUrl: "https://support.microsoft.com/outlook",
}

registerManifest(googleCalendar)
registerManifest(microsoftCalendar)
