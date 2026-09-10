import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { MarketingDraftPage } from "@/components/marketing-draft-page"
import { hreflangLanguages, localePath } from "@/lib/hreflang"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "becomeExpert" })
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localePath(locale, "/become-expert"),
      languages: hreflangLanguages("/become-expert"),
    },
  }
}

export default async function BecomeExpertPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "becomeExpert" })

  return (
    <MarketingDraftPage
      draftBanner={t("draftBanner")}
      heading={t("heading")}
      headingTestId="become-expert-heading"
      body={t("body")}
      ctaHref="/signup"
      ctaLabel={t("cta")}
    />
  )
}
