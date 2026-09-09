import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { Explorer, type ExplorerSearch } from "./explorer"
import { hreflangLanguages } from "@/lib/hreflang"

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<ExplorerSearch>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "experts" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: locale === "en" ? "/experts" : `/${locale}/experts`,
      languages: hreflangLanguages("/experts"),
    },
  }
}

export default async function ExpertsPage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  return <Explorer locale={locale} search={await searchParams} />
}
