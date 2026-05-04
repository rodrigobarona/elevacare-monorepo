import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { ChevronRight } from "lucide-react"

import { listCategories, listExperts, type PublicCategory } from "@eleva/db"
import { ExpertCard } from "@/components/expert-card"
import { MarketplaceFilters } from "@/components/marketplace-filters"
import { Link } from "@/i18n/navigation"
import {
  parseSearchParams,
  buildExpertFilters,
} from "@/lib/marketplace-search-params"

interface PageProps {
  params: Promise<{ locale: string; category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, category } = await params
  const cats = await safeListCategories()
  const cat = cats.find((c) => c.slug === category)
  if (!cat) return {}
  const name = cat.displayName[locale] ?? cat.displayName.en
  return {
    title: name,
    description: cat.description?.[locale] ?? cat.description?.en ?? undefined,
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, category } = await params
  setRequestLocale(locale)
  const search = await searchParams

  const cats = await safeListCategories()
  const cat = cats.find((c) => c.slug === category)
  if (!cat) {
    notFound()
  }

  const t = await getTranslations()
  const baseFilters = buildExpertFilters(parseSearchParams(search), {
    categorySlug: cat.slug,
  })
  const expertsResult = await safeListExperts(baseFilters)

  const name = cat.displayName[locale] ?? cat.displayName.en
  const description = cat.description?.[locale] ?? cat.description?.en ?? null
  const otherCategories = cats
    .filter((c) => c.slug !== cat.slug)
    .map((c) => ({
      slug: c.slug,
      name: c.displayName[locale] ?? c.displayName.en,
    }))

  return (
    <div className="min-h-svh bg-muted/30">
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <Breadcrumb category={name} />
          <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {name}
          </h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              {description}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground/80">
            {t("category.expertCount", { count: expertsResult.total })}
          </p>
          <div className="mt-8">
            <MarketplaceFilters
              categories={otherCategories}
              showCategoryFilter={false}
              basePath={`/experts/${cat.slug}`}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
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
      </section>
    </div>
  )
}

async function Breadcrumb({ category }: { category: string }) {
  const t = await getTranslations()
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <Link href="/" className="hover:text-foreground">
        {t("category.breadcrumbHome")}
      </Link>
      <ChevronRight className="size-3" />
      <Link href="/experts" className="hover:text-foreground">
        {t("category.breadcrumbExperts")}
      </Link>
      <ChevronRight className="size-3" />
      <span className="text-foreground">{category}</span>
    </nav>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card p-10 text-center">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

async function safeListCategories(): Promise<PublicCategory[]> {
  try {
    return await listCategories()
  } catch {
    return []
  }
}

async function safeListExperts(filters: Parameters<typeof listExperts>[0]) {
  try {
    return await listExperts(filters)
  } catch {
    return { experts: [], total: 0, page: 1, pageSize: 24 }
  }
}
