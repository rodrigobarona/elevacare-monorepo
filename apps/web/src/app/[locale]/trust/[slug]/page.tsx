import { isContentLocale } from "@eleva/content/locales"
import { CONSENT_DOCUMENT_VERSION } from "@eleva/compliance"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { LongformLayout } from "@/components/longform-layout"
import { hreflangLanguages, localePath } from "@/lib/hreflang"
import { getTrustMdxDocument } from "@/lib/trust-source"
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

  if (isContentLocale(locale)) {
    const doc = getTrustMdxDocument(slug, locale)
    if (doc) {
      const path = `/trust/${slug}`
      return {
        title: doc.frontmatter.title,
        description: doc.frontmatter.description,
        robots: doc.frontmatter.noindex
          ? { index: false, follow: false }
          : { index: true, follow: true },
        alternates: {
          canonical: localePath(locale, path),
          languages: hreflangLanguages(path),
        },
      }
    }
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
  const tLongform = await getTranslations({ locale, namespace: "longform" })

  if (isContentLocale(locale)) {
    const doc = getTrustMdxDocument(slug, locale)
    if (doc) {
      return (
        <div className="flex min-h-dvh flex-col">
          <SiteHeader />
          <main className="flex-1 px-6 py-16">
            <LongformLayout
              title={doc.frontmatter.title}
              description={
                doc.frontmatter.summary ?? doc.frontmatter.description
              }
              versionLabel={tLongform("versionLabel", {
                version: CONSENT_DOCUMENT_VERSION,
              })}
              lastUpdatedLabel={tLongform("lastUpdatedLabel", {
                date: doc.frontmatter.lastUpdated,
              })}
              tocTitle={tLongform("tocTitle")}
              Body={doc.Body}
              toc={doc.toc}
            />
          </main>
          <SiteFooter />
        </div>
      )
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16">
        <article className="mx-auto max-w-3xl">
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
