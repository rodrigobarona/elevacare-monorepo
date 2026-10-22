"use client"

import { MagnifyingGlassIcon } from "@eleva/icons"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type HelpSearchEntry = {
  url: string
  title: string
  portal: string
  locale: string
  excerpt: string
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase()
}

function scoreEntry(entry: HelpSearchEntry, query: string) {
  const title = entry.title.toLowerCase()
  const excerpt = entry.excerpt.toLowerCase()
  if (title.includes(query)) return 3
  if (entry.portal.includes(query)) return 2
  if (excerpt.includes(query)) return 1
  return 0
}

export function DocsSearch({ localePrefix }: { localePrefix: string }) {
  const [query, setQuery] = useState("")
  const [entries, setEntries] = useState<HelpSearchEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch("/docs/help-search-index.json")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: HelpSearchEntry[]) => {
        if (!cancelled) {
          setEntries(Array.isArray(data) ? data : [])
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const normalized = normalizeQuery(query)
  const results = useMemo(() => {
    if (!normalized || normalized.length < 2) return []
    return entries
      .filter((entry) => {
        if (localePrefix) {
          if (!entry.url.startsWith(localePrefix)) return false
        } else if (/^\/(pt|es)\//.test(entry.url)) {
          return false
        }
        return scoreEntry(entry, normalized) > 0
      })
      .sort((a, b) => scoreEntry(b, normalized) - scoreEntry(a, normalized))
      .slice(0, 8)
  }, [entries, localePrefix, normalized])

  const showResults = normalized.length >= 2 && loaded

  return (
    <div className="relative w-full max-w-xs">
      <label className="sr-only" htmlFor="docs-help-search">
        Search help
      </label>
      <div className="relative">
        <MagnifyingGlassIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id="docs-help-search"
          type="search"
          placeholder="Search help…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background py-1 pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          autoComplete="off"
        />
      </div>
      {showResults && results.length > 0 ? (
        <ul
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md"
          role="listbox"
        >
          {results.map((entry) => (
            <li key={entry.url}>
              <Link
                href={entry.url}
                className="block px-3 py-2 text-sm hover:bg-muted"
                role="option"
              >
                <span className="font-medium text-foreground">
                  {entry.title}
                </span>
                <span className="block text-xs text-muted-foreground capitalize">
                  {entry.portal}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {showResults && results.length === 0 ? (
        <p className="absolute z-20 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
          No matches. Try another keyword.
        </p>
      ) : null}
    </div>
  )
}
