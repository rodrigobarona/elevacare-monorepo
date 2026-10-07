import { getTranslations } from "next-intl/server"
import { ApiClientError } from "@eleva/api-client"
import { VerifiedBadge } from "@eleva/ui/components/brand"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { ExpertAvatar } from "@/components/expert-avatar"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Link } from "@/i18n/navigation"
import { formatEur } from "@/lib/format-eur"
import { localePath } from "@/lib/hreflang"
import { createPublicApiClient } from "@/lib/public-api"

export type ExplorerSearch = {
  language?: string
  sort?: string
  cursor?: string
}

const LANGUAGES = ["pt", "en", "es"] as const
const SORTS = ["relevance", "price", "rating"] as const

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

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        nav={[
          { href: "/", labelKey: "home" },
          { href: "/about", labelKey: "about" },
          { href: "/experts", labelKey: "experts" },
        ]}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <p className="mb-3 text-sm font-medium tracking-widest text-primary uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-heading text-3xl tracking-tight sm:text-4xl">
          {category
            ? t("categoryHeading", { category: t(`categories.${category}`) })
            : t("heading")}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("intro")}</p>

        <form
          className="mt-8 flex flex-wrap items-end gap-4"
          action={localePath(locale, basePath)}
        >
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">
              {t("filters.language")}
            </span>
            <select
              name="language"
              defaultValue={language ?? ""}
              className="block rounded-md border bg-background px-3 py-2"
            >
              <option value="">{t("filters.anyLanguage")}</option>
              {LANGUAGES.map((item) => (
                <option key={item} value={item}>
                  {t(`languages.${item}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">{t("filters.sort")}</span>
            <select
              name="sort"
              defaultValue={sort ?? "relevance"}
              className="block rounded-md border bg-background px-3 py-2"
            >
              {SORTS.map((item) => (
                <option key={item} value={item}>
                  {t(`sort.${item}`)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className={buttonVariants({ variant: "outline" })}
          >
            {t("filters.apply")}
          </button>
        </form>

        {loadError ? (
          <EmptyState
            variant="error"
            className="mt-10"
            title={t("loadError")}
          />
        ) : null}

        {filterError ? (
          <EmptyState
            variant="no-results"
            className="mt-10"
            title={t("filterError")}
            action={
              <Link
                href={basePath}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {t("resetFilters")}
              </Link>
            }
          />
        ) : null}

        {!loadError && !filterError && experts.length === 0 ? (
          <EmptyState
            variant="no-results"
            className="mt-10"
            title={t("empty")}
            action={
              language || sort ? (
                <Link
                  href={basePath}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t("resetFilters")}
                </Link>
              ) : undefined
            }
          />
        ) : null}

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {experts.map((expert) => (
            <li key={expert.username}>
              <Link
                href={`/${expert.username}`}
                data-testid="expert-card"
                data-username={expert.username}
                className="flex h-full gap-4 rounded-xl border p-5 transition-colors hover:bg-muted/40"
              >
                <ExpertAvatar
                  displayName={expert.displayName}
                  username={expert.username}
                  avatarUrl={expert.avatarUrl}
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-semibold tracking-tight">
                    {expert.displayName}
                    <VerifiedBadge title={t("verified")} />
                    {expert.topExpertActive ? (
                      <span className="text-xs font-medium text-primary">
                        {t("topExpert")}
                      </span>
                    ) : null}
                  </p>
                  {expert.headline ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {expert.headline}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm">
                    {expert.minPriceCents != null
                      ? t("fromPrice", {
                          price: formatEur(expert.minPriceCents, locale),
                        })
                      : t("priceOnRequest")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {expert.languages
                      .map((item) =>
                        LANGUAGES.includes(item as (typeof LANGUAGES)[number])
                          ? t(`languages.${item as (typeof LANGUAGES)[number]}`)
                          : item
                      )
                      .join(" · ")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {nextCursor ? (
          <div className="mt-10">
            <Link
              href={filterHref({ cursor: nextCursor })}
              className="text-sm font-medium text-primary"
            >
              {t("nextPage")}
            </Link>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  )
}
