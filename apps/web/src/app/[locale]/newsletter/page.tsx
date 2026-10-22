import { getEditorialPillars } from "@eleva/config/editorial-pillars"
import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { PillarPage } from "@/components/pillar-page"
import { hreflangLanguages, localePath } from "@/lib/hreflang"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "pillars.newsletter" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: localePath(locale, "/newsletter"),
      languages: hreflangLanguages("/newsletter"),
    },
  }
}

export default async function NewsletterPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "pillars.newsletter" })
  const pillars = getEditorialPillars()
  const embedUrl = pillars.newsletterEmbedUrl

  return (
    <PillarPage
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      body={t("body")}
      primaryCta={{
        href: pillars.newsletterUrl,
        label: t("cta"),
        external: true,
      }}
      embed={embedUrl ? { title: t("embedTitle"), src: embedUrl } : undefined}
    />
  )
}
