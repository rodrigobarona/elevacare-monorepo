import { EU_PHONE_COUNTRIES } from "@eleva/config"
import type { LocalizedText } from "../schema/main"

export type OfferFixtureMode = {
  mode: "online" | "phone" | "in_person"
  schedule: string
  location?: string
  countryScopeType: "worldwide" | "list"
  countryScopeCodes: string[]
  languages: string[]
  priceCents?: number
}

export type OfferFixtureEventType = {
  slug: string
  title: LocalizedText
  kind: "clinical" | "non_clinical"
  durationMinutes: number
  priceAmount: number
  languages: string[]
  modes: OfferFixtureMode[]
}

export type OfferFixtureLocation = {
  name: string
  address: string
  city: string
  region: string
  country: string
  timezone: string
  isPrimary?: boolean
}

export type OfferFixtureSchedule = {
  name: string
  timezone: string
  isDefault?: boolean
}

export type OfferFixture = {
  user: { email: string; name: string }
  org: { slug: string; name: string }
  profile: {
    username: string
    displayName: string
    languages: string[]
    practiceCountry: string
    serviceCountries: string[]
    worldwideRemote: boolean
  }
  schedules: OfferFixtureSchedule[]
  locations: OfferFixtureLocation[]
  eventTypes: OfferFixtureEventType[]
}

/** Every fixture schedule is open Monday–Friday 09:00–17:00 in its timezone. */
export const OFFER_FIXTURE_WEEKDAYS = [1, 2, 3, 4, 5] as const
export const OFFER_FIXTURE_DAY_START = "09:00:00"
export const OFFER_FIXTURE_DAY_END = "17:00:00"

const QUICK_CHAT_LANGUAGES = ["pt", "en", "es", "fr"]

export const QUICK_CHAT_FIXTURE: OfferFixture = {
  user: { email: "coach.quick@example.test", name: "Ana Quick" },
  org: { slug: "anaquick", name: "Ana Quick (solo)" },
  profile: {
    username: "anaquick",
    displayName: "Ana Quick",
    languages: QUICK_CHAT_LANGUAGES,
    practiceCountry: "PT",
    serviceCountries: [...EU_PHONE_COUNTRIES],
    worldwideRemote: true,
  },
  schedules: [
    { name: "Online", timezone: "Europe/Lisbon", isDefault: true },
    { name: "Phone", timezone: "Europe/Lisbon" },
  ],
  locations: [],
  eventTypes: [
    {
      slug: "quick-chat",
      title: { en: "Quick chat", pt: "Conversa rápida", es: "Charla rápida" },
      kind: "non_clinical",
      durationMinutes: 20,
      priceAmount: 0,
      languages: QUICK_CHAT_LANGUAGES,
      modes: [
        {
          mode: "online",
          schedule: "Online",
          countryScopeType: "worldwide",
          countryScopeCodes: [],
          languages: QUICK_CHAT_LANGUAGES,
        },
        {
          mode: "phone",
          schedule: "Phone",
          countryScopeType: "list",
          countryScopeCodes: [...EU_PHONE_COUNTRIES],
          languages: QUICK_CHAT_LANGUAGES,
        },
      ],
    },
  ],
}

const PHYSIO_LANGUAGES = ["pt", "en", "es"]

export const PHYSIOTHERAPY_FIXTURE: OfferFixture = {
  user: { email: "fisio.mota@example.test", name: "Fisio Mota" },
  org: { slug: "fisiomota", name: "Fisio Mota (solo)" },
  profile: {
    username: "fisiomota",
    displayName: "Fisio Mota",
    languages: PHYSIO_LANGUAGES,
    practiceCountry: "PT",
    serviceCountries: ["PT", "ES"],
    worldwideRemote: false,
  },
  schedules: [
    { name: "Online", timezone: "Europe/Lisbon", isDefault: true },
    { name: "Lisboa clinic", timezone: "Europe/Lisbon" },
    { name: "Porto clinic", timezone: "Europe/Lisbon" },
    { name: "Madrid clinic", timezone: "Europe/Madrid" },
  ],
  locations: [
    {
      name: "Lisboa",
      address: "Av. da Liberdade 100",
      city: "Lisboa",
      region: "Lisboa",
      country: "PT",
      timezone: "Europe/Lisbon",
      isPrimary: true,
    },
    {
      name: "Porto",
      address: "Rua de Santa Catarina 200",
      city: "Porto",
      region: "Porto",
      country: "PT",
      timezone: "Europe/Lisbon",
    },
    {
      name: "Madrid",
      address: "Calle de Alcalá 50",
      city: "Madrid",
      region: "Madrid",
      country: "ES",
      timezone: "Europe/Madrid",
    },
  ],
  eventTypes: [
    {
      slug: "first-visit",
      title: {
        en: "First visit",
        pt: "Primeira consulta",
        es: "Primera visita",
      },
      kind: "clinical",
      durationMinutes: 60,
      priceAmount: 6000,
      languages: PHYSIO_LANGUAGES,
      modes: [
        {
          mode: "online",
          schedule: "Online",
          countryScopeType: "list",
          countryScopeCodes: ["PT", "ES"],
          languages: PHYSIO_LANGUAGES,
          priceCents: 6000,
        },
      ],
    },
    {
      slug: "follow-up",
      title: { en: "Follow-up", pt: "Seguimento", es: "Seguimiento" },
      kind: "clinical",
      durationMinutes: 45,
      priceAmount: 4500,
      languages: PHYSIO_LANGUAGES,
      modes: [
        {
          mode: "in_person",
          schedule: "Lisboa clinic",
          location: "Lisboa",
          countryScopeType: "list",
          countryScopeCodes: ["PT"],
          languages: PHYSIO_LANGUAGES,
          priceCents: 4500,
        },
        {
          mode: "in_person",
          schedule: "Porto clinic",
          location: "Porto",
          countryScopeType: "list",
          countryScopeCodes: ["PT"],
          languages: PHYSIO_LANGUAGES,
          priceCents: 4500,
        },
        {
          mode: "in_person",
          schedule: "Madrid clinic",
          location: "Madrid",
          countryScopeType: "list",
          countryScopeCodes: ["ES"],
          languages: PHYSIO_LANGUAGES,
          priceCents: 5500,
        },
      ],
    },
  ],
}
