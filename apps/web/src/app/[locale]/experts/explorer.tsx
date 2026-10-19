import type { ReactNode } from "react"
import { getTranslations } from "next-intl/server"
import { ApiClientError } from "@eleva/api-client"
import { ArrowRightIcon, CaretDownIcon } from "@eleva/icons"
import { CtaBand } from "@eleva/ui/blocks/cta-band"
import { ExpertCard } from "@eleva/ui/blocks/expert-card"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { displayLanguageLabel } from "@eleva/ui/lib/booking/display-names"
import { cn } from "@eleva/ui/lib/utils"
import { ExpertPortrait } from "@/components/expert-portrait"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Link } from "@/i18n/navigation"
import { formatEur } from "@/lib/format-eur"
import { localePath } from "@/lib/hreflang"
import {
  isMarketplaceCategory,
  MARKETPLACE_CATEGORY_SLUGS,
} from "@/lib/marketplace-categories"
import { createPublicApiClient } from "@/lib/public-api"

export type ExplorerSearch = {
  language?: string
  sort?: string
  cursor?: string
}

const LANGUAGES = ["pt", "en", "es"] as const
const SORTS = ["relevance", "price", "rating"] as const

const SELECT_CLASS =
  "h-10 w-full appearance-none rounded-full border bg-background py-2 pr-9 pl-4 text-sm shadow-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

export async function Explorer({
  locale,
  category,
  search,
}: {
  locale: string
  category?: string
  search: ExplorerSearch
}) {
  const t = await getTranslations("experts")
  const language = LANGUAGES.find((item) => item === search.language)
  const sort = SORTS.find((item) => item === search.sort)
  const api = createPublicApiClient()

  let experts: Awaited<ReturnType<typeof api.public.listExperts>>["experts"] =
    []
  let nextCursor: string | null = null
  let loadError = false
  let filterError = false

  try {
    const result = await api.public.listExperts({
      ...(category ? { category } : {}),
      ...(language ? { language } : {}),
      ...(sort ? { sort } : {}),
      ...(search.cursor ? { cursor: search.cursor } : {}),
    })
    experts = result.experts
    nextCursor = result.nextCursor
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 422) {
      filterError = true
    } else {
      loadError = true
    }
  }

  const basePath = category ? `/experts/${category}` : "/experts"
  const filterHref = (next: ExplorerSearch) => {
    const params = new URLSearchParams()
    const nextLanguage = next.language ?? language
    const nextSort = next.sort ?? sort
    if (nextLanguage) params.set("language", nextLanguage)
    if (nextSort) params.set("sort", nextSort)
    if (next.cursor) params.set("cursor", next.cursor)
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  const categoryLabel = (slug: string) =>
    isMarketplaceCategory(slug) ? t(`categories.${slug}`) : null

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Section spacing="compact" className="pt-16 sm:pt-20">
          <Container className="flex flex-col gap-8">
            <SectionHeader
              as="h1"
              eyebrow={t("eyebrow")}
              title={
                category
                  ? t("categoryHeading", {
                      category: t(`categories.${category}`),
                    })
                  : t("heading")
              }
              lead={t("intro")}
            />

            <nav aria-label={t("categoriesLabel")}>
              <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                <li>
                  <CategoryChip href="/experts" isActive={!category}>
                    {t("allCategories")}
                  </CategoryChip>
                </li>
                {MARKETPLACE_CATEGORY_SLUGS.map((slug) => (
                  <li key={slug}>
                    <CategoryChip
                      href={`/experts/${slug}`}
                      isActive={category === slug}
                    >
                      {t(`categories.${slug}`)}
                    </CategoryChip>
                  </li>
                ))}
              </ul>
            </nav>

            <form
              className="flex flex-wrap items-end gap-3 rounded-3xl border bg-muted/50 p-4"
              action={localePath(locale, basePath)}
            >
              <FilterSelect
                label={t("filters.language")}
                name="language"
                defaultValue={language ?? ""}
              >
                <option value="">{t("filters.anyLanguage")}</option>
                {LANGUAGES.map((item) => (
                  <option key={item} value={item}>
                    {t(`languages.${item}`)}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label={t("filters.sort")}
                name="sort"
                defaultValue={sort ?? "relevance"}
              >
                {SORTS.map((item) => (
                  <option key={item} value={item}>
                    {t(`sort.${item}`)}
                  </option>
                ))}
              </FilterSelect>
              <button
                type="submit"
                className={buttonVariants({ className: "rounded-full" })}
              >
                {t("filters.apply")}
              </button>
              {language || sort ? (
                <Link
                  href={basePath}
                  className={buttonVariants({
                    variant: "ghost",
                    className: "rounded-full",
                  })}
                >
                  {t("resetFilters")}
                </Link>
              ) : null}
            </form>
          </Container>
        </Section>

        <Section spacing="compact" className="pt-0">
          <Container>
            {loadError ? (
              <EmptyState variant="error" title={t("loadError")} />
            ) : null}

            {filterError ? (
              <EmptyState
                variant="no-results"
                title={t("filterError")}
                action={
                  <Link
                    href={basePath}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    {t("resetFilters")}
                  </Link>
                }
              />
            ) : null}

            {!loadError && !filterError && experts.length === 0 ? (
              <EmptyState
                variant="no-results"
                title={t("empty")}
                action={
                  language || sort ? (
                    <Link
                      href={basePath}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      {t("resetFilters")}
                    </Link>
                  ) : undefined
                }
              />
            ) : null}

            {experts.length > 0 ? (
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {experts.map((expert) => (
                  <li key={expert.username}>
                    <ExpertCard
                      data-testid="expert-card"
                      data-username={expert.username}
                      href={`/${expert.username}`}
                      linkAs={Link}
                      media={
                        <ExpertPortrait
                          displayName={expert.displayName}
                          username={expert.username}
                          avatarUrl={expert.avatarUrl}
                        />
                      }
                      name={expert.displayName}
                      headline={expert.headline}
                      badge={
                        expert.topExpertActive ? t("topExpert") : undefined
                      }
                      tags={expert.categorySlugs
                        .map(categoryLabel)
                        .filter((label) => label !== null)
                        .slice(0, 3)}
                      meta={expert.languages
                        .map((code) => displayLanguageLabel(code, locale))
                        .join(" · ")}
                      price={
                        expert.minPriceCents == null
                          ? t("priceOnRequest")
                          : expert.minPriceCents === 0
                            ? t("free")
                            : t("fromPrice", {
                                price: formatEur(expert.minPriceCents, locale),
                              })
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : null}

            {nextCursor ? (
              <div className="mt-10 flex justify-center">
                <Link
                  href={filterHref({ cursor: nextCursor })}
                  className={buttonVariants({
                    variant: "outline",
                    className: "rounded-full",
                  })}
                >
                  {t("nextPage")}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </div>
            ) : null}
          </Container>
        </Section>

        <Section spacing="compact" className="pb-24">
          <Container>
            <CtaBand
              eyebrow={t("join.eyebrow")}
              title={t("join.heading")}
              lead={t("join.lead")}
              actions={
                <Link
                  href="/become-expert"
                  className={buttonVariants({ variant: "inverse", size: "lg" })}
                >
                  {t("join.cta")}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              }
            />
          </Container>
        </Section>
      </main>
      <SiteFooter />
    </div>
  )
}

function CategoryChip({
  href,
  isActive,
  children,
}: {
  href: string
  isActive: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors",
        isActive
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-muted"
      )}
    >
      {children}
    </Link>
  )
}

function FilterSelect({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string
  name: string
  defaultValue: string
  children: ReactNode
}) {
  return (
    <label className="flex min-w-44 flex-col gap-1.5 text-sm">
      <span className="px-1 text-muted-foreground">{label}</span>
      <span className="relative">
        <select
          name={name}
          defaultValue={defaultValue}
          className={SELECT_CLASS}
        >
          {children}
        </select>
        <CaretDownIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </span>
    </label>
  )
}
