import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { hreflangLanguages, localePath } from "@/lib/hreflang"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "contact" })
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localePath(locale, "/contact"),
      languages: hreflangLanguages("/contact"),
    },
  }
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "contact" })

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
          <h1
            data-testid="contact-heading"
            className="text-3xl font-bold tracking-tight"
          >
            {t("heading")}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            {t("body")}
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}
