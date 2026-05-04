import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"

import { listCategories, type PublicCategory } from "@eleva/db"
import { BecomePartnerForm } from "@/components/become-partner/become-partner-form"

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "becomePartner.hero" })
  return {
    title: t("title"),
    description: t("subtitle"),
  }
}

export default async function BecomePartnerPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const cats = await safeListCategories()
  const localized = cats.map((c) => ({
    slug: c.slug,
    name: c.displayName[locale] ?? c.displayName.en,
    description: c.description?.[locale] ?? c.description?.en ?? null,
  }))

  return (
    <div className="min-h-svh bg-muted/30">
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t("becomePartner.hero.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            {t("becomePartner.hero.subtitle")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <BecomePartnerForm categories={localized} />
      </section>
    </div>
  )
}

async function safeListCategories(): Promise<PublicCategory[]> {
  try {
    return await listCategories()
  } catch {
    return []
  }
}
