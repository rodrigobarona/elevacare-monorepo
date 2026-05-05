import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"

import { Alert, AlertDescription, AlertTitle } from "@eleva/ui/components/alert"

const LEGAL_SLUGS = ["privacy", "terms", "cookies"] as const
type LegalSlug = (typeof LEGAL_SLUGS)[number]

function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value)
}

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLegalSlug(slug)) return {}
  const t = await getTranslations({
    locale,
    namespace: `legal.documents.${slug}`,
  })
  return { title: t("title"), description: t("summary") }
}

export default async function LegalPage({ params }: PageProps) {
  const { locale, slug } = await params
  if (!isLegalSlug(slug)) {
    notFound()
  }
  setRequestLocale(locale)
  const t = await getTranslations()

  const docKey = `legal.documents.${slug}` as const
  const lastUpdated = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
  }).format(new Date("2026-04-01"))

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
      <header className="mb-10">
        <p className="text-sm tracking-wide text-muted-foreground uppercase">
          {t("legal.title")}
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t(`${docKey}.title`)}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          {t(`${docKey}.summary`)}
        </p>
        <p className="mt-3 text-sm text-muted-foreground/80">
          {t("legal.lastUpdated", { date: lastUpdated })}
        </p>
      </header>

      <Alert variant="info">
        <AlertTitle>{t("legal.placeholderTitle")}</AlertTitle>
        <AlertDescription>{t("legal.placeholderBody")}</AlertDescription>
      </Alert>
    </article>
  )
}
