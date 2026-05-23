export type Locale = "en" | "pt" | "es"

export type PracticeCountry = "PT" | "ES" | "BR"

export type LocalizedString = Record<Locale, string>

export type SessionMode = "online" | "in_person" | "both"

export interface ExpertDraft {
  workspaceName: string
  specialty: string
  subSpecialty: string
  practiceCountry: PracticeCountry
  city: string
  /** True after city name geocoded to coordinates (not just country preset) */
  cityGeocoded: boolean
  /** Language the expert writes in naturally — AI translates from this locale */
  primaryLocale: Locale
  yearsInField: number
  professionalTitle: string
  linkedIn: string
  meetingAddress: string
  meetingLatitude: number | null
  meetingLongitude: number | null
  headline: LocalizedString
  qualifications: LocalizedString
  recognition: LocalizedString
  bio: LocalizedString
  eventTitle: LocalizedString
  eventDescription: LocalizedString
  eventDuration: number
  eventPrice: number
  sessionMode: SessionMode
  languages: Locale[]
  photos: string[]
  coverPhotoIndex: number
  nif: string
  licenseScope: string
  telehealthAck: boolean | null
  insuranceAck: boolean | null
  introOffers: boolean | null
  complianceAck: boolean
  termsAccepted: boolean
}

import { getCountryCenter } from "@/lib/map-basemaps"

export const EMPTY_LOCALIZED: LocalizedString = { en: "", pt: "", es: "" }

export function createDefaultDraft(): ExpertDraft {
  const { lat, lng } = getCountryCenter("PT")
  return {
    workspaceName: "",
    specialty: "",
    subSpecialty: "",
    practiceCountry: "PT",
    city: "",
    cityGeocoded: false,
    primaryLocale: "en",
    yearsInField: 5,
    professionalTitle: "",
    linkedIn: "",
    meetingAddress: "",
    meetingLatitude: lat,
    meetingLongitude: lng,
    headline: { ...EMPTY_LOCALIZED },
    qualifications: { ...EMPTY_LOCALIZED },
    recognition: { ...EMPTY_LOCALIZED },
    bio: { ...EMPTY_LOCALIZED },
    eventTitle: { ...EMPTY_LOCALIZED },
    eventDescription: { ...EMPTY_LOCALIZED },
    eventDuration: 50,
    eventPrice: 65,
    sessionMode: "online",
    languages: ["en", "pt"],
    photos: [],
    coverPhotoIndex: 0,
    nif: "",
    licenseScope: "",
    telehealthAck: null,
    insuranceAck: null,
    introOffers: null,
    complianceAck: false,
    termsAccepted: false,
  }
}

export const SPECIALTIES = [
  {
    id: "womens-health",
    label: "Women's health",
    subs: ["Pregnancy", "Postpartum", "Menopause", "Sexual health"],
  },
  {
    id: "nutrition",
    label: "Nutrition & wellness",
    subs: ["Clinical nutrition", "Sports nutrition", "Mindful eating"],
  },
  {
    id: "mental-health",
    label: "Mental wellbeing",
    subs: ["Anxiety", "Perinatal mood", "Stress management"],
  },
  {
    id: "physiotherapy",
    label: "Physiotherapy",
    subs: ["Pelvic floor", "Prenatal", "Postnatal recovery"],
  },
  {
    id: "lactation",
    label: "Lactation support",
    subs: ["Breastfeeding", "Pumping", "Weaning"],
  },
  {
    id: "sleep",
    label: "Sleep coaching",
    subs: ["Infant sleep", "Adult sleep", "Family routines"],
  },
] as const

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
}

export const COUNTRY_LABELS: Record<PracticeCountry, string> = {
  PT: "Portugal",
  ES: "Spain",
  BR: "Brazil",
}
