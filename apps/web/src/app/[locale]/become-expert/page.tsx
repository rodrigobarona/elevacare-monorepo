import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import {
  MarketingDraftPage,
  type MarketingIconId,
} from "@/components/marketing-draft-page"
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
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      headingTestId="become-expert-heading"
      body={t("body")}
      imageSlug="expert-at-desk"
      cta={{ href: "/signup", label: t("cta") }}
      stepsHeading={t("stepsHeading")}
      steps={t.raw("steps") as { title: string; body: string }[]}
      benefitsHeading={t("benefitsHeading")}
      benefits={
        t.raw("benefits") as {
          icon: MarketingIconId
          title: string
          body: string
        }[]
      }
      requirementsHeading={t("requirementsHeading")}
      requirements={t.raw("requirements") as { title: string; body: string }[]}
      finalHeading={t("finalHeading")}
      finalBody={t("finalBody")}
      finalCta={{ href: "/signup", label: t("finalCta") }}
    />
  )
}
