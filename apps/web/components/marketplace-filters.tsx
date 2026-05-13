"use client"

import { useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { usePathname } from "@/i18n/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { Button } from "@eleva/ui/components/button"
import {
  SESSION_MODES,
  LANGUAGE_OPTIONS,
  COUNTRY_CODES,
} from "@/lib/marketplace-constants"

interface MarketplaceFiltersProps {
  categories: Array<{ slug: string; name: string }>
  basePath: string
}

export function MarketplaceFilters({
  categories,
  basePath,
}: MarketplaceFiltersProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations()

  const setFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && value !== "__any") {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page")
      router.push(`${basePath}?${params.toString()}`, { scroll: false })
    },
    [searchParams, router, basePath]
  )

  const clearAll = useCallback(() => {
    router.push(basePath, { scroll: false })
  }, [router, basePath])

  const hasFilters =
    searchParams.has("category") ||
    searchParams.has("language") ||
    searchParams.has("country") ||
    searchParams.has("session")

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={searchParams.get("category") ?? "__any"}
        onValueChange={(v) => setFilter("category", v)}
      >
        <SelectTrigger className="h-9 w-40 text-xs">
          <SelectValue placeholder={t("marketplace.filters.anyCategory")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any">
            {t("marketplace.filters.anyCategory")}
          </SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.slug} value={c.slug}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("language") ?? "__any"}
        onValueChange={(v) => setFilter("language", v)}
      >
        <SelectTrigger className="h-9 w-32 text-xs">
          <SelectValue placeholder={t("marketplace.filters.anyLanguage")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any">
            {t("marketplace.filters.anyLanguage")}
          </SelectItem>
          {LANGUAGE_OPTIONS.map((l) => (
            <SelectItem key={l.value} value={l.value}>
              {t(`locale.${l.labelKey}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("country") ?? "__any"}
        onValueChange={(v) => setFilter("country", v)}
      >
        <SelectTrigger className="h-9 w-28 text-xs">
          <SelectValue placeholder={t("marketplace.filters.anyCountry")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any">
            {t("marketplace.filters.anyCountry")}
          </SelectItem>
          {COUNTRY_CODES.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("session") ?? "__any"}
        onValueChange={(v) => setFilter("session", v)}
      >
        <SelectTrigger className="h-9 w-36 text-xs">
          <SelectValue placeholder={t("marketplace.filters.anySessionMode")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any">
            {t("marketplace.filters.anySessionMode")}
          </SelectItem>
          {SESSION_MODES.map((m) => (
            <SelectItem key={m} value={m}>
              {t(`marketplace.sessionMode.${m}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="text-xs"
        >
          {t("marketplace.search.filtersClear")}
        </Button>
      )}
    </div>
  )
}
