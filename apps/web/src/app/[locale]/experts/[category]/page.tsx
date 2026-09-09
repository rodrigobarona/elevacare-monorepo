import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Explorer, type ExplorerSearch } from "../explorer"
import { hreflangLanguages } from "@/lib/hreflang"
import { isMarketplaceCategory } from "@/lib/marketplace-categories"

type Props = {
  params: Promise<{ locale: string; category: string }>
  searchParams: Promise<ExplorerSearch>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params
  if (!isMarketplaceCategory(category)) notFound()
  const t = await getTranslations({ locale, namespace: "experts" })
  const label = t(`categories.${category}`)
  const path = `/experts/${category}`
  return {
    title: t("categoryTitle", { category: label }),
    description: t("description"),
    alternates: {
      canonical: locale === "en" ? path : `/${locale}${path}`,
      languages: hreflangLanguages(path),
    },
  }
}

export default async function ExpertCategoryPage({
  params,
  searchParams,
}: Props) {
  const { locale, category } = await params
  if (!isMarketplaceCategory(category)) notFound()
  setRequestLocale(locale)
  return (
    <Explorer locale={locale} category={category} search={await searchParams} />
  )
}
