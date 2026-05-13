import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"

import { Button } from "@eleva/ui/components/button"
import { GradientHero } from "@/components/gradient-hero"
import { Section } from "@/components/section"
import { SectionHeading } from "@/components/section-heading"

const VALID_SLUGS = ["privacy", "terms", "cookies"] as const
type LegalSlug = (typeof VALID_SLUGS)[number]

function isValidSlug(slug: string): slug is LegalSlug {
  return (VALID_SLUGS as readonly string[]).includes(slug)
}

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isValidSlug(slug)) return {}
  const t = await getTranslations({ locale, namespace: "legal" })
  return {
    title: t(`documents.${slug}.title`),
    description: t(`documents.${slug}.summary`),
  }
}

export default async function LegalPage({ params }: PageProps) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  if (!isValidSlug(slug)) {
    notFound()
  }

  const t = await getTranslations("legal")

  return (
    <>
      <GradientHero
        eyebrow={`${t("title")} · ${t("lastUpdated", { date: "2025" })}`}
        title={t(`documents.${slug}.title`)}
        subtitle={t(`documents.${slug}.summary`)}
      />

      <Section>
        <SectionHeading>{t("placeholderTitle")}</SectionHeading>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
          {t("placeholderBody")}
        </p>
        <div className="mt-8">
          <Button variant="outline" asChild>
            <a href="mailto:legal@eleva.care">legal@eleva.care</a>
          </Button>
        </div>
      </Section>
    </>
  )
}
