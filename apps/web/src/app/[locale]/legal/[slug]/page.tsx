import { isContentLocale } from "@eleva/content/locales"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { LongformLayout } from "@/components/longform-layout"
import { hreflangLanguages, localePath } from "@/lib/hreflang"
import { getLegalMdxDocument } from "@/lib/legal-source"
import { formatLastUpdated } from "@/lib/last-updated"
import { isLegalSlug, LEGAL_SLUGS } from "@/lib/legal-slugs"

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }))
}

/** Every legal document exists in every site language (content test). */
function loadDocument(locale: string, slug: string) {
  if (!isLegalSlug(slug) || !isContentLocale(locale)) return null
  return getLegalMdxDocument(slug, locale)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const doc = loadDocument(locale, slug)
  if (!doc) return {}
  const path = `/legal/${slug}`
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

export default async function LegalDocumentPage({ params }: Props) {
  const { locale, slug } = await params
  const doc = loadDocument(locale, slug)
  if (!doc) notFound()
  setRequestLocale(locale)
  const tLongform = await getTranslations({ locale, namespace: "longform" })

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16">
        <LongformLayout
          title={doc.frontmatter.title}
          description={doc.frontmatter.summary ?? doc.frontmatter.description}
          lastUpdatedLabel={tLongform("lastUpdatedLabel", {
            date: formatLastUpdated(locale, doc.frontmatter.lastUpdated),
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
