import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"

type DocsChromeCopy = {
  helpCenter: string
  portals: { members: string; experts: string; clinics: string }
  evidenceBasedCare: string
  portalsNavLabel: string
  helpTopics: string
  onThisPage: string
}

const en: DocsChromeCopy = {
  helpCenter: "Help center",
  portals: {
    members: "Members",
    experts: "Experts",
    clinics: "Clinics",
  },
  evidenceBasedCare: "Evidence-based care",
  portalsNavLabel: "Help portals",
  helpTopics: "Help topics",
  onThisPage: "On this page",
}

const pt: DocsChromeCopy = {
  helpCenter: "Centro de ajuda",
  portals: {
    members: "Membros",
    experts: "Especialistas",
    clinics: "Clínicas",
  },
  evidenceBasedCare: "Cuidados baseados em evidência",
  portalsNavLabel: "Portais de ajuda",
  helpTopics: "Tópicos de ajuda",
  onThisPage: "Nesta página",
}

const es: DocsChromeCopy = {
  helpCenter: "Centro de ayuda",
  portals: {
    members: "Miembros",
    experts: "Expertas",
    clinics: "Clínicas",
  },
  evidenceBasedCare: "Atención basada en evidencia",
  portalsNavLabel: "Portales de ayuda",
  helpTopics: "Temas de ayuda",
  onThisPage: "En esta página",
}

const COPY: Record<Locale, DocsChromeCopy> = { en, pt, es }

export function getDocsChromeCopy(locale: string): DocsChromeCopy {
  return isLocale(locale) ? COPY[locale] : COPY[defaultLocale]
}
