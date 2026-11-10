import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"

type DocsChromeCopy = {
  helpCenter: string
  portals: { members: string; experts: string; clinics: string }
  hubIntro: string
  hubDescription: string
  portalDescriptions: { members: string; experts: string; clinics: string }
  machineIndex: string
  searchLabel: string
  searchPlaceholder: string
  titleSuffix: string
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
  hubIntro:
    "Pick your guide: booking and joining sessions, running your practice, or setting up a clinic.",
  hubDescription: "Guides for members, experts and clinics using Eleva Care.",
  portalDescriptions: {
    members: "Book an expert, join your sessions and manage payments.",
    experts: "Set up your practice, publish your services and get paid.",
    clinics: "Create your clinic and see how clinics work on Eleva.",
  },
  machineIndex: "Index for AI assistants:",
  searchLabel: "Search help",
  searchPlaceholder: "Search help…",
  titleSuffix: "Eleva Care help",
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
  hubIntro:
    "Escolha o seu guia: marcar e entrar nas sessões, gerir a sua prática ou criar uma clínica.",
  hubDescription:
    "Guias para membros, especialistas e clínicas que usam a Eleva Care.",
  portalDescriptions: {
    members: "Marque um especialista, entre nas sessões e gira os pagamentos.",
    experts: "Configure a sua prática, publique os seus serviços e receba.",
    clinics: "Crie a sua clínica e veja como funcionam as clínicas na Eleva.",
  },
  machineIndex: "Índice para assistentes de IA:",
  searchLabel: "Pesquisar na ajuda",
  searchPlaceholder: "Pesquisar na ajuda…",
  titleSuffix: "Ajuda Eleva Care",
  evidenceBasedCare: "Cuidados baseados em evidência",
  portalsNavLabel: "Portais de ajuda",
  helpTopics: "Tópicos de ajuda",
  onThisPage: "Nesta página",
}

const es: DocsChromeCopy = {
  helpCenter: "Centro de ayuda",
  portals: {
    members: "Miembros",
    experts: "Especialistas",
    clinics: "Clínicas",
  },
  hubIntro:
    "Elige tu guía: reservar y unirte a tus sesiones, llevar tu consulta o crear una clínica.",
  hubDescription:
    "Guías para miembros, especialistas y clínicas que usan Eleva Care.",
  portalDescriptions: {
    members:
      "Reserva un especialista, únete a tus sesiones y gestiona tus pagos.",
    experts: "Configura tu consulta, publica tus servicios y cobra.",
    clinics: "Crea tu clínica y descubre cómo funcionan las clínicas en Eleva.",
  },
  machineIndex: "Índice para asistentes de IA:",
  searchLabel: "Buscar en la ayuda",
  searchPlaceholder: "Buscar en la ayuda…",
  titleSuffix: "Ayuda de Eleva Care",
  evidenceBasedCare: "Atención basada en evidencia",
  portalsNavLabel: "Portales de ayuda",
  helpTopics: "Temas de ayuda",
  onThisPage: "En esta página",
}

const COPY: Record<Locale, DocsChromeCopy> = { en, pt, es }

export function getDocsChromeCopy(locale: string): DocsChromeCopy {
  return isLocale(locale) ? COPY[locale] : COPY[defaultLocale]
}
