import { isContentLocale } from "@eleva/content/locales"
import { CONSENT_DOCUMENT_VERSION } from "@eleva/compliance"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { LongformLayout } from "@/components/longform-layout"
import { hreflangLanguages, localePath } from "@/lib/hreflang"
import { getPageMdxDocument } from "@/lib/pages-source"

const SLUG = "evidence-based-care"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isContentLocale(locale)) {
    return {}
  }
  const doc = getPageMdxDocument(SLUG, locale)
  if (!doc) {
    return {}
  }
  const path = `/${SLUG}`
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

export default async function EvidenceBasedCarePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const tLongform = await getTranslations({ locale, namespace: "longform" })

  if (!isContentLocale(locale)) {
    notFound()
  }
  const doc = getPageMdxDocument(SLUG, locale)
  if (!doc) {
    notFound()
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16">
        <LongformLayout
          title={doc.frontmatter.title}
          description={doc.frontmatter.summary ?? doc.frontmatter.description}
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
