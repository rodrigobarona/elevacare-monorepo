import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { hreflangLanguages, localePath } from "@/lib/hreflang"
import { isTrustSlug, TRUST_SLUGS } from "@/lib/trust-slugs"

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export function generateStaticParams() {
  return TRUST_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isTrustSlug(slug)) {
    return {}
  }
  const t = await getTranslations({ locale, namespace: "trust" })
  const path = `/trust/${slug}`
  return {
    title: t(`pages.${slug}.title`),
    description: t(`pages.${slug}.description`),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localePath(locale, path),
      languages: hreflangLanguages(path),
    },
  }
}

export default async function TrustPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isTrustSlug(slug)) {
    notFound()
  }
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "trust" })

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        nav={[
          { href: "/", labelKey: "home" },
          { href: "/experts", labelKey: "experts" },
        ]}
      />
      <main className="flex-1 px-6 py-16">
        <article className="mx-auto max-w-3xl">
          <p
            data-testid="legal-draft-banner"
            className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50"
          >
            {t("draftBanner")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            {t(`pages.${slug}.heading`)}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            {t(`pages.${slug}.body`)}
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}
