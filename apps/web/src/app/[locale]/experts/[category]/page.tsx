import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { Explorer, type ExplorerSearch } from "../explorer"
import { hreflangLanguages } from "@/lib/hreflang"

type Props = {
  params: Promise<{ locale: string; category: string }>
  searchParams: Promise<ExplorerSearch>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params
  const t = await getTranslations({ locale, namespace: "experts" })
  const path = `/experts/${category}`
  return {
    title: t("categoryTitle", { category }),
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
  setRequestLocale(locale)
  return (
    <Explorer locale={locale} category={category} search={await searchParams} />
  )
}
