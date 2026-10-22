/**
 * D-10 public-site parity (SSOT).
 *
 * Gateway 301s and e2e/legacy-urls.spec.ts both consume this module.
 * Contact and trust pages stay working drafts — no invented DPO/finance claims.
 */

import { defaultLocale, isLocale, type Locale } from "./i18n"

const QUIZ_FIRST_SEGMENTS = new Set([
  "quiz",
  "health-quiz",
  "questionario",
  "cuestionario",
])

const HELP_FIRST_SEGMENTS = new Set(["help", "support", "faq"])

/** Legacy eleva-care-app help URLs → Fumadocs portal slugs under `/docs`. */
const LEGACY_HELP_PORTAL: Record<string, "members" | "experts" | "clinics"> = {
  patient: "members",
  expert: "experts",
  workspace: "clinics",
}

function docsHelpPath(
  locale: Locale,
  portal: "members" | "experts" | "clinics",
  articleSegments: string[]
): string {
  const localeInDocs = locale === defaultLocale ? "" : `/${locale}`
  const article =
    articleSegments.length > 0 ? `/${articleSegments.join("/")}` : ""
  return `/docs${localeInDocs}/${portal}${article}`
}

function rewriteLegacyHelpPath(pathname: string): string | null {
  const { locale, rest } = parseLocalePath(pathname)
  const first = rest[0]?.toLowerCase()
  if (!first || !HELP_FIRST_SEGMENTS.has(first)) return null

  if (first !== "help") {
    return "/docs"
  }
  if (rest.length === 1) {
    return "/docs"
  }

  const legacyPortal = rest[1]?.toLowerCase() ?? ""
  const portal = LEGACY_HELP_PORTAL[legacyPortal]
  if (!portal) {
    return "/docs"
  }
  return docsHelpPath(locale, portal, rest.slice(2))
}

export const COMMUNITY_EXTERNAL_LINKS = [
  { id: "instagram", href: "https://instagram.com/eleva.care" },
  { id: "linkedin", href: "https://linkedin.com/company/eleva-care" },
] as const

function localePrefix(locale: Locale): string {
  return locale === defaultLocale ? "" : `/${locale}`
}

function parseLocalePath(pathname: string): { locale: Locale; rest: string[] } {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]
  if (first && isLocale(first) && segments.length > 1) {
    return { locale: first, rest: segments.slice(1) }
  }
  return { locale: defaultLocale, rest: segments }
}

/**
 * Returns a same-origin 301 pathname, or null when the path is not a
 * retired MVP surface. `/pt-BR/*` is handled by rewriteRetiredLocalePath.
 */
export function rewriteParityPath(pathname: string): string | null {
  const { locale, rest } = parseLocalePath(pathname)
  const first = rest[0]?.toLowerCase()
  if (!first) return null

  if (QUIZ_FIRST_SEGMENTS.has(first)) {
    return `${localePrefix(locale)}/experts`
  }
  const legacyHelp = rewriteLegacyHelpPath(pathname)
  if (legacyHelp) {
    return legacyHelp
  }
  if (first === "trust" && rest.length === 1) {
    return `${localePrefix(locale)}/trust/security`
  }
  if (first === "legal" && rest[1]?.toLowerCase() === "cookie") {
    return `${localePrefix(locale)}/legal/cookies`
  }
  if (first === "legal" && rest[1]?.toLowerCase() === "payment-policies") {
    return `${localePrefix(locale)}/legal/payments`
  }
  return null
}

export const PUBLIC_SITE_PARITY_REDIRECTS = [
  { id: "quiz-en", path: "/quiz", locationPath: "/experts" },
  { id: "quiz-pt", path: "/pt/quiz", locationPath: "/pt/experts" },
  { id: "quiz-es", path: "/es/quiz", locationPath: "/es/experts" },
  { id: "health-quiz", path: "/health-quiz", locationPath: "/experts" },
  {
    id: "questionario-pt",
    path: "/pt/questionario",
    locationPath: "/pt/experts",
  },
  {
    id: "cuestionario-es",
    path: "/es/cuestionario",
    locationPath: "/es/experts",
  },
  { id: "help-en", path: "/help", locationPath: "/docs" },
  { id: "help-patient", path: "/help/patient", locationPath: "/docs/members" },
  {
    id: "help-patient-booking",
    path: "/help/patient/booking",
    locationPath: "/docs/members/booking",
  },
  {
    id: "help-pt-article",
    path: "/pt/help/patient/booking",
    locationPath: "/docs/pt/members/booking",
  },
  { id: "help-expert", path: "/help/expert", locationPath: "/docs/experts" },
  {
    id: "help-workspace",
    path: "/es/help/workspace",
    locationPath: "/docs/es/clinics",
  },
  { id: "support", path: "/support", locationPath: "/docs" },
  { id: "faq-pt", path: "/pt/faq", locationPath: "/docs" },
  { id: "trust-index", path: "/trust", locationPath: "/trust/security" },
  {
    id: "legal-cookie",
    path: "/legal/cookie",
    locationPath: "/legal/cookies",
  },
  {
    id: "legal-cookie-pt",
    path: "/pt/legal/cookie",
    locationPath: "/pt/legal/cookies",
  },
  {
    id: "legal-payment-policies",
    path: "/legal/payment-policies",
    locationPath: "/legal/payments",
  },
] as const

export const RETIRED_LOCALE_REDIRECTS = [
  { id: "pt-br-root", path: "/pt-BR", locationPath: "/pt" },
  { id: "pt-br-experts", path: "/pt-BR/experts", locationPath: "/pt/experts" },
] as const
