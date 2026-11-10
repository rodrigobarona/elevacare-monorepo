import type { ReactNode } from "react"
import { getTranslations } from "next-intl/server"
import {
  ApiClientError,
  type ListPublicExpertsResponse,
} from "@eleva/api-client"
import { defaultLocale, isLocale } from "@eleva/config/i18n"
import { ArrowRightIcon, CaretDownIcon, XIcon } from "@eleva/icons"
import { ElevaImage } from "@eleva/media/image"
import { CtaBand } from "@eleva/ui/blocks/cta-band"
import { ExpertCard } from "@eleva/ui/blocks/expert-card"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { cn } from "@eleva/ui/lib/utils"
import { ExpertPortrait } from "@eleva/ui/blocks/expert-portrait"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Link } from "@/i18n/navigation"
import { formatEur } from "@/lib/format-eur"
import { localePath } from "@/lib/hreflang"
import {
  isMarketplaceCategory,
  MARKETPLACE_CATEGORY_SLUGS,
} from "@/lib/marketplace-categories"
import { createServerPublicApiClient } from "@/lib/public-api-server"

export type ExplorerSearch = {
  language?: string
  sort?: string
  cursor?: string
}

const LANGUAGES = ["pt", "en", "es"] as const
const SORTS = ["relevance", "price", "rating"] as const

/**
 * Below this many listed experts the directory is a short, curated list:
 * no language or sort controls (spec rev 2.2 §1). Deep links keep working.
 */
const DIRECTORY_FILTERS_MIN_EXPERTS = 12

const SELECT_CLASS =
  "h-10 w-full appearance-none rounded-full border border-input-border bg-background py-2 pr-9 pl-4 text-sm shadow-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

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
  // Server render: forward the visitor IP so each visitor gets their own
  // rate-limit bucket instead of sharing the server egress IP.
  const api = await createServerPublicApiClient()
  const isNarrowed = Boolean(category || language || search.cursor)

  let experts: ListPublicExpertsResponse["experts"] = []
  let nextCursor: string | null = null
  let loadError = false
  let filterError = false
  // The unfiltered first page decides which areas get a chip and whether
  // the directory is large enough for filters. Null when it could not be
  // loaded: the page then offers every control rather than guessing from a
  // filtered result.
  let directory: ListPublicExpertsResponse | null = null

  try {
    const [result, everyone] = await Promise.all([
      api.public.listExperts({
        ...(category ? { category } : {}),
        ...(language ? { language } : {}),
        ...(sort ? { sort } : {}),
        ...(search.cursor ? { cursor: search.cursor } : {}),
      }),
      // Only shapes the chips and filters; never fails the page.
      isNarrowed ? api.public.listExperts({}).catch(() => null) : null,
    ])
    experts = result.experts
    nextCursor = result.nextCursor
    directory = isNarrowed ? everyone : result
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

  // A directory that spans several pages (or could not be loaded) is not a
  // short curated list: every control and every area chip is offered, since
  // one page cannot tell which areas have experts.
  const isLargeOrUnknown =
    !loadError &&
    !filterError &&
    (directory == null ||
      directory.nextCursor != null ||
      directory.experts.length >= DIRECTORY_FILTERS_MIN_EXPERTS)
  const showFilters = isLargeOrUnknown
  const listedAreas = new Set(
    (directory?.experts ?? []).flatMap((expert) => expert.categorySlugs)
  )
  const areaSlugs = MARKETPLACE_CATEGORY_SLUGS.filter(
    (slug) => isLargeOrUnknown || listedAreas.has(slug) || slug === category
  )
  const sortLabel = sort && sort !== "relevance" ? t(`sort.${sort}`) : null
  const showAreas = areaSlugs.length >= 2 || category != null

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

            {showAreas ? (
              <nav aria-label={t("categoriesLabel")}>
                <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                  <li>
                    <CategoryChip href="/experts" isActive={!category}>
                      {t("allCategories")}
                    </CategoryChip>
                  </li>
                  {areaSlugs.map((slug) => (
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
            ) : null}

            {showFilters ? (
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
            ) : language || sortLabel ? (
              // Short list: a deep link's filter or sort shows as a chip
              // that removes only itself.
              <div className="flex flex-wrap gap-2">
                {language ? (
                  <RemovableChip
                    href={filterHref({ language: "" })}
                    label={t("removeLanguageFilter", {
                      language: t(`languages.${language}`),
                    })}
                  >
                    {t("speaksLanguage", {
                      language: t(`languages.${language}`),
                    })}
                  </RemovableChip>
                ) : null}
                {sortLabel ? (
                  <RemovableChip
                    href={filterHref({ sort: "" })}
                    label={t("removeSort", { sort: sortLabel })}
                  >
                    {t("sortedBy", { sort: sortLabel })}
                  </RemovableChip>
                ) : null}
              </div>
            ) : null}
          </Container>
        </Section>

        <Section spacing="compact" className="pt-0 sm:pt-0">
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
                title={category && !language ? t("emptyCategory") : t("empty")}
                action={
                  category || language || sort ? (
                    <Link
                      href="/experts"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      {t("seeAll")}
                    </Link>
                  ) : undefined
                }
              />
            ) : null}

            {experts.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                {experts.map((expert) => {
                  const areas = expert.categorySlugs
                    .map(categoryLabel)
                    .filter((label) => label !== null)
                    .slice(0, 2)
                  return (
                    <li key={expert.username}>
                      <ExpertCard
                        data-testid="expert-card"
                        data-username={expert.username}
                        href={`/${expert.username}`}
                        linkAs={Link}
                        media={
                          <ExpertPortrait
                            displayName={expert.displayName}
                            avatarUrl={expert.avatarUrl}
                          />
                        }
                        name={expert.displayName}
                        headline={expert.headline}
                        badge={
                          expert.topExpertActive ? t("topExpert") : undefined
                        }
                        meta={areas.length > 0 ? areas.join(" · ") : undefined}
                        price={
                          expert.minPriceCents == null
                            ? undefined
                            : expert.minPriceCents === 0
                              ? t("freeSession")
                              : t("fromPrice", {
                                  price: formatEur(
                                    expert.minPriceCents,
                                    locale
                                  ),
                                })
                        }
                      />
                    </li>
                  )
                })}
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

            {experts.length > 0 ? (
              <p
                className="mt-10 max-w-2xl text-sm text-pretty text-muted-foreground"
                data-testid="experts-ranking-note"
              >
                {t("trustLine")} {showFilters ? `${t("rankingNote")} ` : null}
                <Link
                  href={`/legal/terms#${t("rankingAnchor")}`}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {t("rankingLink")}
                </Link>
              </p>
            ) : null}
          </Container>
        </Section>

        <Section spacing="compact" className="pb-24">
          <Container>
            <CtaBand
              eyebrow={t("join.eyebrow")}
              title={t("join.heading")}
              lead={t("join.lead")}
              media={
                <ElevaImage
                  slug="physio-session"
                  locale={isLocale(locale) ? locale : defaultLocale}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
              }
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

function RemovableChip({
  href,
  label,
  children,
}: {
  href: string
  /** Names what pressing it removes. */
  label: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-background px-4 text-sm transition-colors hover:bg-muted"
    >
      {children}
      <XIcon aria-hidden className="size-4" />
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
