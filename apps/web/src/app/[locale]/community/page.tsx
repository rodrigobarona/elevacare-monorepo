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
  const t = await getTranslations({ locale, namespace: "pillars.community" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: localePath(locale, "/community"),
      languages: hreflangLanguages("/community"),
    },
  }
}

export default async function CommunityPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "pillars.community" })
  const pillars = getEditorialPillars()

  return (
    <PillarPage
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      body={t("body")}
      primaryCta={{
        href: pillars.communityUrl,
        label: t("cta"),
        external: true,
      }}
    />
  )
}
