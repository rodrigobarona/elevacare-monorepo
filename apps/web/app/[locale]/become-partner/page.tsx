import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"

import { listCategories } from "@eleva/db"
import { GradientHero } from "@/components/gradient-hero"
import { Section } from "@/components/section"
import { BecomePartnerForm } from "@/components/become-partner-form"

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "becomePartner" })
  return { title: t("hero.title"), description: t("hero.subtitle") }
}

export default async function BecomePartnerPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("becomePartner")

  let categories: Array<{ slug: string; name: string }> = []
  try {
    const raw = await listCategories()
    categories = raw.map((c) => ({
      slug: c.slug,
      name: c.displayName[locale] ?? c.displayName.en,
    }))
  } catch {}

  return (
    <>
      <GradientHero
        eyebrow={t("hero.title")}
        title={t("hero.title")}
        subtitle={t("hero.subtitle")}
      />
      <Section>
        <BecomePartnerForm categories={categories} />
      </Section>
    </>
  )
}
