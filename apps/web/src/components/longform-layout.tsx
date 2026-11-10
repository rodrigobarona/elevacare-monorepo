import type { TOCItemType } from "fumadocs-core/toc"
import type { ReactNode } from "react"
import { TableOfContents } from "@eleva/content/toc"
import { getMdxComponents } from "@eleva/content/mdx-components"
import type { MDXComponents } from "mdx/types"
import type { ComponentType } from "react"

type Body = ComponentType<{ components?: MDXComponents }>

export function LongformLayout({
  title,
  description,
  lastUpdatedLabel,
  tocTitle,
  Body,
  toc,
  children,
}: {
  title: string
  description?: string
  lastUpdatedLabel: string
  tocTitle: string
  Body?: Body
  toc: readonly TOCItemType[]
  /** Fallback when the page is not MDX-driven yet. */
  children?: ReactNode
}) {
  const components = getMdxComponents()
  // Frontmatter titles carry the brand for the browser tab; the page
  // heading does not repeat it.
  const heading = title.replace(/\s+[—–-]\s+Eleva(?:\.care| Care)$/, "")

  return (
    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
      <article className="max-w-3xl min-w-0 lg:max-w-none">
        <h1 className="font-display text-4xl leading-tight font-normal tracking-tight text-balance sm:text-5xl">
          {heading}
        </h1>
        {description ? (
          <p className="mt-3 text-lg text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
        <p
          data-testid="longform-last-updated"
          className="mt-4 text-sm text-muted-foreground"
        >
          {lastUpdatedLabel}
        </p>
        <div className="longform-prose mt-8 text-base text-foreground/90">
          {Body ? <Body components={components} /> : children}
        </div>
      </article>
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <TableOfContents items={toc} title={tocTitle} />
        </div>
      </aside>
    </div>
  )
}
