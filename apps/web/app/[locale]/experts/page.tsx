import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"

import { ExpertCard } from "@/components/expert-card"
import { MarketplaceFilters } from "@/components/marketplace-filters"
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

type SessionModeKey = "online" | "in_person" | "phone"

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "marketplace" })
  return {
    title: t("title"),
    description: t("subtitle"),
  }
}

export default async function ExpertsPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const search = await searchParams

  const parsed = parseSearchParams(search)
  parsed.locale = locale

  const [t, categoriesRaw, expertsResult] = await Promise.all([
    getTranslations(),
    safeListCategories(),
    safeListExperts(buildExpertFilters(parsed)),
  ])

  const categories: { slug: string; name: string }[] = categoriesRaw.map((c) =>
    pickCategoryName(c, locale)
  )

  return (
    <div className="min-h-svh bg-muted/30">
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t("marketplace.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            {t("marketplace.subtitle")}
          </p>
          <div className="mt-8">
            <MarketplaceFilters categories={categories} basePath={`/experts`} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="mb-6 text-sm text-muted-foreground">
          {t("marketplace.search.results", { count: expertsResult.total })}
        </p>
        {expertsResult.experts.length === 0 ? (
          <EmptyState
            title={t("marketplace.search.noResults.title")}
            body={t("marketplace.search.noResults.body")}
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
      </section>
    </div>
  )
}

// Re-exported from lib/ for typing — keeps SessionModeKey usable inside
// the route file if we later add more derived computation.
export type { SessionModeKey }
