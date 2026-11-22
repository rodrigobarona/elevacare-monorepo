import { notFound } from "next/navigation"

import { locales, type Locale } from "@eleva/config/i18n-locales"

import { GlobalErrorFixture } from "./fixture"

/**
 * The content of the full-page fallback, on a page of its own, so
 * `e2e/route-error.spec.ts` can capture it. The real fallback replaces the
 * root layout when that fails, which this page does not do.
 */
export default async function GlobalErrorFixturePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  return <GlobalErrorFixture locale={locale as Locale} />
}
