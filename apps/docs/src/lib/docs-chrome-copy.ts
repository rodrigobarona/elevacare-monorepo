import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"

type DocsChromeCopy = {
  helpCenter: string
  portals: { members: string; experts: string; clinics: string }
  evidenceBasedCare: string
  portalsNavLabel: string
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
}

const COPY: Record<Locale, DocsChromeCopy> = { en, pt, es }

export function getDocsChromeCopy(locale: string): DocsChromeCopy {
  return isLocale(locale) ? COPY[locale] : COPY[defaultLocale]
}
