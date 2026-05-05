"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search, X } from "lucide-react"

import { usePathname, useRouter } from "@/i18n/navigation"

import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import {
  COUNTRY_CODES as COUNTRY_OPTIONS,
  LANGUAGE_OPTIONS,
  SESSION_MODES as SESSION_MODE_OPTIONS,
} from "@/lib/marketplace-constants"

export interface CategoryOption {
  slug: string
  name: string
}

const ANY_VALUE = "__any__"
const SEARCH_DEBOUNCE_MS = 300

export function MarketplaceFilters({
  categories,
  showCategoryFilter = true,
  basePath,
}: {
  categories: CategoryOption[]
  showCategoryFilter?: boolean
  /** Path to push to when applying filters. Defaults to current pathname. */
  basePath?: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentQ = params.get("q") ?? ""
  const [searchValue, setSearchValue] = useState(currentQ)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    setSearchValue(params.get("q") ?? "")
  }, [params])

  const navigate = useCallback(
    (next: URLSearchParams) => {
      next.delete("page")
      const search = next.toString()
      const target = `${basePath ?? pathname}${search ? `?${search}` : ""}`
      startTransition(() => router.replace(target))
    },
    [basePath, pathname, router, startTransition]
  )

  const current = {
    category: params.get("category") ?? ANY_VALUE,
    language: params.get("language") ?? ANY_VALUE,
    country: params.get("country") ?? ANY_VALUE,
    sessionMode: params.get("session") ?? ANY_VALUE,
  }

  const hasActive =
    current.category !== ANY_VALUE ||
    current.language !== ANY_VALUE ||
    current.country !== ANY_VALUE ||
    current.sessionMode !== ANY_VALUE ||
    currentQ.length > 0

  function update(
    key: "category" | "language" | "country" | "session",
    value: string
  ) {
    const next = new URLSearchParams(params.toString())
    if (value === ANY_VALUE) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    navigate(next)
  }

  function handleSearchChange(value: string) {
    setSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      const trimmed = value.trim()
      if (trimmed.length >= 2) {
        next.set("q", trimmed)
      } else {
        next.delete("q")
      }
      navigate(next)
    }, SEARCH_DEBOUNCE_MS)
  }

  function clearAll() {
    setSearchValue("")
    const target = basePath ?? pathname
    startTransition(() => router.replace(target))
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("marketplace.search.placeholder")}
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          disabled={isPending}
          className="pl-9"
          aria-label={t("marketplace.search.placeholder")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {showCategoryFilter ? (
          <FilterField label={t("marketplace.filters.category")}>
            <Select
              value={current.category}
              onValueChange={(v) => update("category", v)}
              disabled={isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t("marketplace.filters.anyCategory")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>
                  {t("marketplace.filters.anyCategory")}
                </SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        ) : null}

        <FilterField label={t("marketplace.filters.language")}>
          <Select
            value={current.language}
            onValueChange={(v) => update("language", v)}
            disabled={isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("marketplace.filters.anyLanguage")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>
                {t("marketplace.filters.anyLanguage")}
              </SelectItem>
              {LANGUAGE_OPTIONS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {t(`locale.${l.labelKey}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label={t("marketplace.filters.country")}>
          <Select
            value={current.country}
            onValueChange={(v) => update("country", v)}
            disabled={isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("marketplace.filters.anyCountry")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>
                {t("marketplace.filters.anyCountry")}
              </SelectItem>
              {COUNTRY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label={t("marketplace.filters.sessionMode")}>
          <Select
            value={current.sessionMode}
            onValueChange={(v) => update("session", v)}
            disabled={isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={t("marketplace.filters.anySessionMode")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>
                {t("marketplace.filters.anySessionMode")}
              </SelectItem>
              {SESSION_MODE_OPTIONS.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t(`marketplace.sessionMode.${mode}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {hasActive ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={isPending}
            >
              <X className="size-4" />
              {t("marketplace.search.filtersClear")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function FilterField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  )
}
