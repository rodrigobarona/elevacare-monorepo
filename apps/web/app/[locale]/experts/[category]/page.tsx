import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"

import { ExpertCard } from "@/components/expert-card"
import { MarketplaceFilters } from "@/components/marketplace-filters"
import { Section } from "@/components/section"
import { SectionHeading } from "@/components/section-heading"
import { Eyebrow } from "@/components/eyebrow"
import {
  EmptyState,
  pickCategoryName,
  safeListCategories,
  safeListExperts,
} from "@/lib/marketplace-helpers"
import {
  parseSearchParams,
  buildExpertFilters,
} from "@/lib/marketplace-search-params"
import { Link } from "@/i18n/navigation"

interface PageProps {
  params: Promise<{ locale: string; category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, category } = await params
  const allCats = await safeListCategories()
  const cat = allCats.find((c) => c.slug === category)
  if (!cat) return {}
  const name = cat.displayName[locale] ?? cat.displayName.en
  const t = await getTranslations({ locale, namespace: "category" })
  return { title: name, description: t("expertCount", { count: 0 }) }
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, category } = await params
  setRequestLocale(locale)
  const search = await searchParams

  const allCats = await safeListCategories()
  const cat = allCats.find((c) => c.slug === category)
  if (!cat) notFound()

  const catName = cat.displayName[locale] ?? cat.displayName.en
  const catDesc = cat.description?.[locale] ?? cat.description?.en ?? null

  const parsed = parseSearchParams(search)
  parsed.category = category
  parsed.locale = locale

  const [t, expertsResult] = await Promise.all([
    getTranslations(),
    safeListExperts(buildExpertFilters(parsed)),
  ])

  const categories = allCats.map((c) => pickCategoryName(c, locale))

  return (
    <>
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <nav
            className="mb-4 text-sm text-muted-foreground"
            aria-label="Breadcrumb"
          >
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-foreground">
                  {t("category.breadcrumbHome")}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href="/experts" className="hover:text-foreground">
                  {t("category.breadcrumbExperts")}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-foreground" aria-current="page">
                {catName}
              </li>
            </ol>
          </nav>
          <Eyebrow>{t("marketplace.filters.category")}</Eyebrow>
          <SectionHeading as="h1" className="mt-2">
            {catName}
          </SectionHeading>
          {catDesc && (
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              {catDesc}
            </p>
          )}
          <div className="mt-8">
            <MarketplaceFilters
              categories={categories}
              basePath={`/experts/${category}`}
            />
          </div>
        </div>
      </section>

      <Section className="bg-muted/20">
        <p className="mb-6 text-sm text-muted-foreground">
          {t("category.expertCount", { count: expertsResult.total })}
        </p>
        {expertsResult.experts.length === 0 ? (
          <EmptyState
            title={t("category.noExperts.title")}
            body={t("category.noExperts.body")}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {expertsResult.experts.map((expert) => (
              <li key={expert.username}>
                <ExpertCard
                  expert={expert}
                  labels={{
                    topExpert: t("marketplace.card.topExpert"),
                    languagesLabel: t("marketplace.card.languagesLabel"),
                    countriesLabel: t("marketplace.card.countriesLabel"),
                    viewProfile: t("marketplace.card.viewProfile"),
                    sessionMode: {
                      online: t("marketplace.sessionMode.online"),
                      in_person: t("marketplace.sessionMode.in_person"),
                      phone: t("marketplace.sessionMode.phone"),
                    },
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
