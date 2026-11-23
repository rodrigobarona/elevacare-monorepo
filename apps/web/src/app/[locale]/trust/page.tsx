import { LEGAL_SLUGS } from "@eleva/config/legal-slugs"
import { isContentLocale, type ContentLocale } from "@eleva/content/locales"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Link } from "@/i18n/navigation"
import { hreflangLanguages, localePath } from "@/lib/hreflang"
import { formatLastUpdated } from "@/lib/last-updated"
import { getLegalMdxDocument } from "@/lib/legal-source"
import { getTrustMdxDocument } from "@/lib/trust-source"
import { TRUST_SLUGS } from "@/lib/trust-slugs"

type Props = {
  params: Promise<{ locale: string }>
}

type IndexEntry = {
  href: string
  title: string
  summary: string
  lastUpdated: string
}

const TITLE_SUFFIX = / — Eleva\.care$/

function toEntry(
  href: string,
  doc: ReturnType<typeof getTrustMdxDocument>
): IndexEntry | null {
  if (!doc) return null
  return {
    href,
    title: doc.frontmatter.title.replace(TITLE_SUFFIX, ""),
    summary: doc.frontmatter.summary ?? doc.frontmatter.description,
    lastUpdated: doc.frontmatter.lastUpdated,
  }
}

function listEntries(locale: ContentLocale) {
  const present = (entry: IndexEntry | null): entry is IndexEntry =>
    entry !== null
  return {
    trust: TRUST_SLUGS.map((slug) =>
      toEntry(`/trust/${slug}`, getTrustMdxDocument(slug, locale))
    ).filter(present),
    legal: LEGAL_SLUGS.map((slug) =>
      toEntry(`/legal/${slug}`, getLegalMdxDocument(slug, locale))
    ).filter(present),
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "trust.index" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: localePath(locale, "/trust"),
      languages: hreflangLanguages("/trust"),
    },
  }
}

function DocumentList({
  entries,
  locale,
  lastUpdatedLabel,
}: {
  entries: IndexEntry[]
  locale: string
  lastUpdatedLabel: (date: string) => string
}) {
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {entries.map((entry) => (
        <li key={entry.href}>
          <Link
            href={entry.href}
            className="flex h-full flex-col gap-2 rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/30"
          >
            <span className="font-medium text-foreground">{entry.title}</span>
            <span className="text-sm text-pretty text-muted-foreground">
              {entry.summary}
            </span>
            <span className="mt-auto pt-2 text-xs text-muted-foreground">
              {lastUpdatedLabel(formatLastUpdated(locale, entry.lastUpdated))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function TrustIndexPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "trust.index" })
  const tLongform = await getTranslations({ locale, namespace: "longform" })
  const entries = listEntries(isContentLocale(locale) ? locale : "en")
  const lastUpdatedLabel = (date: string) =>
    tLongform("lastUpdatedLabel", { date })

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Section>
          <Container>
            <SectionHeader as="h1" title={t("heading")} lead={t("lead")} />
            <section
              aria-labelledby="trust-documents"
              data-testid="trust-index-documents"
              className="mt-12"
            >
              <h2
                id="trust-documents"
                className="text-xl font-semibold tracking-tight"
              >
                {t("trustGroup")}
              </h2>
              <DocumentList
                entries={entries.trust}
                locale={locale}
                lastUpdatedLabel={lastUpdatedLabel}
              />
            </section>
            <section aria-labelledby="legal-documents" className="mt-12">
              <h2
                id="legal-documents"
                className="text-xl font-semibold tracking-tight"
              >
                {t("legalGroup")}
              </h2>
              <DocumentList
                entries={entries.legal}
                locale={locale}
                lastUpdatedLabel={lastUpdatedLabel}
              />
            </section>
            <p className="mt-12 max-w-2xl text-sm text-pretty text-muted-foreground">
              {t.rich("contact", {
                privacy: (chunks) => (
                  <a
                    href="mailto:privacy@eleva.care"
                    className="text-foreground underline underline-offset-4"
                  >
                    {chunks}
                  </a>
                ),
                security: (chunks) => (
                  <a
                    href="mailto:security@eleva.care"
                    className="text-foreground underline underline-offset-4"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </Container>
        </Section>
      </main>
      <SiteFooter />
    </div>
  )
}
