import { isContentLocale } from "@eleva/content/locales"
import { CONSENT_DOCUMENT_VERSION } from "@eleva/compliance"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { LongformLayout } from "@/components/longform-layout"
import { hreflangLanguages, localePath } from "@/lib/hreflang"
import { getLegalMdxDocument } from "@/lib/legal-source"
import {
  isLegalMdxSlug,
  isLegalSlug,
  LEGAL_PARAGRAPH_KEYS,
  LEGAL_SLUGS,
} from "@/lib/legal-slugs"

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLegalSlug(slug)) {
    return {}
  }

  if (isLegalMdxSlug(slug) && isContentLocale(locale)) {
    const doc = getLegalMdxDocument(slug, locale)
    if (doc) {
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
  }

  const t = await getTranslations({ locale, namespace: "legal" })
  const path = `/legal/${slug}`
  return {
    title: t(`documents.${slug}.title`),
    description: t(`documents.${slug}.description`),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localePath(locale, path),
      languages: hreflangLanguages(path),
    },
  }
}

export default async function LegalDocumentPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLegalSlug(slug)) {
    notFound()
  }
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "legal" })
  const tLongform = await getTranslations({ locale, namespace: "longform" })

  if (isLegalMdxSlug(slug) && isContentLocale(locale)) {
    const doc = getLegalMdxDocument(slug, locale)
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

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16">
        <article className="mx-auto max-w-3xl">
          <p
            data-testid="legal-draft-banner"
            className="mb-4 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-warning"
          >
            {t("draftBanner")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("versionLabel", { version: CONSENT_DOCUMENT_VERSION })}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            {t(`documents.${slug}.heading`)}
          </h1>
          <div className="mt-8 space-y-4 text-base leading-relaxed text-muted-foreground">
            {LEGAL_PARAGRAPH_KEYS.map((key) => (
              <p key={key}>{t(`documents.${slug}.paragraphs.${key}`)}</p>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}
