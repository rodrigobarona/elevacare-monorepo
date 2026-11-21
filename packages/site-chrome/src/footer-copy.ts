import type { Locale } from "@eleva/config/i18n"
import { LEGAL_ENTITY_LINE } from "@eleva/config/legal-entity"

export type FooterCopy = {
  tagline: string
  solutions: string
  about: string
  story: string
  becomeExpert: string
  forClinics: string
  legal: string
  terms: string
  privacy: string
  healthData: string
  aiProcessing: string
  cookies: string
  cookieSettings: string
  payments: string
  expertAgreement: string
  accessibility: string
  complaints: string
  complaintsBook: string
  trustHub: string
  evidenceBasedCare: string
  credits: string
  community: string
  newsletter: string
  podcast: string
  helpCenter: string
  instagram: string
  linkedin: string
  rights: (year: string) => string
  /** Legal entity line for checkout, where the member is about to pay. */
  operator: string
  /** Label of the checkout footer's links. */
  legalAndHelp: string
  /** Screen-reader note on links that open in a new tab. */
  newTab: string
}

const en: FooterCopy = {
  tagline:
    "Expert women's health care, close to you. Online, by phone or in person.",
  solutions: "Join Eleva",
  about: "About",
  story: "Our story",
  becomeExpert: "Become an expert",
  forClinics: "For clinics",
  legal: "Legal",
  terms: "Terms",
  privacy: "Privacy",
  healthData: "Health data",
  aiProcessing: "AI processing",
  cookies: "Cookies",
  cookieSettings: "Cookie settings",
  payments: "Payments",
  expertAgreement: "Expert agreement",
  accessibility: "Accessibility",
  complaints: "Complaints",
  complaintsBook: "Electronic complaints book",
  trustHub: "Trust and security",
  evidenceBasedCare: "Evidence-based care",
  credits: "Photo credits",
  community: "Community",
  newsletter: "Femme Focus newsletter",
  podcast: "Podcast",
  helpCenter: "Help center",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  rights: (year) => `© ${year} Eleva.care. All rights reserved.`,
  operator: `Eleva.care is operated by ${LEGAL_ENTITY_LINE}`,
  legalAndHelp: "Legal and help",
  newTab: "opens in a new tab",
}

const pt: FooterCopy = {
  tagline:
    "Cuidados especializados de saúde da mulher, perto de si. Online, por telefone ou presencialmente.",
  solutions: "Juntar-se à Eleva",
  about: "Sobre",
  story: "A nossa história",
  becomeExpert: "Tornar-se especialista",
  forClinics: "Para clínicas",
  legal: "Legal",
  terms: "Termos",
  privacy: "Privacidade",
  healthData: "Dados de saúde",
  aiProcessing: "Tratamento por IA",
  cookies: "Cookies",
  cookieSettings: "Definições de cookies",
  payments: "Pagamentos",
  expertAgreement: "Acordo de especialistas",
  accessibility: "Acessibilidade",
  complaints: "Reclamações",
  complaintsBook: "Livro de reclamações eletrónico",
  trustHub: "Confiança e segurança",
  evidenceBasedCare: "Cuidados baseados em evidência",
  credits: "Créditos de fotografia",
  community: "Comunidade",
  newsletter: "Newsletter Femme Focus",
  podcast: "Podcast",
  helpCenter: "Centro de ajuda",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  rights: (year) => `© ${year} Eleva.care. Todos os direitos reservados.`,
  operator: `A Eleva.care é operada por ${LEGAL_ENTITY_LINE}`,
  legalAndHelp: "Informação legal e ajuda",
  newTab: "abre num novo separador",
}

const es: FooterCopy = {
  tagline:
    "Atención especializada en salud de la mujer, cerca de ti. Online, por teléfono o presencial.",
  solutions: "Únete a Eleva",
  about: "Sobre nosotros",
  story: "Nuestra historia",
  becomeExpert: "Conviértete en experta",
  forClinics: "Para clínicas",
  legal: "Legal",
  terms: "Términos",
  privacy: "Privacidad",
  healthData: "Datos de salud",
  aiProcessing: "Tratamiento con IA",
  cookies: "Cookies",
  cookieSettings: "Configuración de cookies",
  payments: "Pagos",
  expertAgreement: "Acuerdo de expertas",
  accessibility: "Accesibilidad",
  complaints: "Reclamaciones",
  complaintsBook: "Libro de reclamaciones electrónico",
  trustHub: "Confianza y seguridad",
  evidenceBasedCare: "Atención basada en evidencia",
  credits: "Créditos fotográficos",
  community: "Comunidad",
  newsletter: "Newsletter Femme Focus",
  podcast: "Podcast",
  helpCenter: "Centro de ayuda",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  rights: (year) => `© ${year} Eleva.care. Todos los derechos reservados.`,
  operator: `Eleva.care es un servicio de ${LEGAL_ENTITY_LINE}`,
  legalAndHelp: "Información legal y ayuda",
  newTab: "se abre en una pestaña nueva",
}

export const FOOTER_COPY: Record<Locale, FooterCopy> = { en, pt, es }

export function getFooterCopy(locale: Locale): FooterCopy {
  return FOOTER_COPY[locale] ?? FOOTER_COPY.en
}
