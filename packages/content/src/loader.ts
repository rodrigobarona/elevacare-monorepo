import type { ComponentType } from "react"
import type { MDXComponents } from "mdx/types"
import type { Root } from "fumadocs-core/page-tree"
import type { TOCItemType } from "fumadocs-core/toc"
import type { z } from "zod"
import { isContentLocale, type ContentLocale } from "./locales"

export type ContentBody = ComponentType<{ components?: MDXComponents }>

/**
 * One rendered long-form document. Pages depend on this shape only, so the
 * source (Git MDX today, a CMS later) can change without touching routes.
 */
export type ContentDocument<TFrontmatter> = {
  slug: readonly string[]
  url: string
  locale: ContentLocale
  frontmatter: TFrontmatter
  Body: ContentBody
  toc: readonly TOCItemType[]
}

export interface ContentLoader<TFrontmatter> {
  getDocument(
    slug: readonly string[],
    locale: ContentLocale
  ): ContentDocument<TFrontmatter> | undefined
  listDocuments(locale: ContentLocale): ContentDocument<TFrontmatter>[]
  getTree(locale: ContentLocale): Root
}

/** Structural subset of a Fumadocs `loader()` page that the adapter reads. */
type FumadocsPage = {
  slugs: string[]
  url: string
  locale?: string
  data: object & {
    body: ContentBody
    toc: TOCItemType[]
  }
}

/** Structural subset of a Fumadocs `loader()` result. */
type FumadocsSource = {
  getPage(slugs: string[] | undefined, language?: string): unknown
  getPages(language?: string): unknown[]
  getPageTree(locale?: string): Root
}

/**
 * Adapts a Fumadocs `loader()` (backed by `fumadocs-mdx` collections) to the
 * {@link ContentLoader} contract. Frontmatter is re-parsed through the Zod
 * schema so pages only see the declared fields.
 */
export function createFumadocsContentLoader<TSchema extends z.ZodType>(
  source: FumadocsSource,
  schema: TSchema
): ContentLoader<z.infer<TSchema>> {
  function toDocument(
    raw: unknown,
    locale: ContentLocale
  ): ContentDocument<z.infer<TSchema>> {
    const page = raw as FumadocsPage
    return {
      slug: page.slugs,
      url: page.url,
      // A missing translation falls back to the default locale's file.
      locale:
        page.locale && isContentLocale(page.locale) ? page.locale : locale,
      frontmatter: schema.parse(page.data),
      Body: page.data.body,
      toc: page.data.toc,
    }
  }

  return {
    getDocument(slug, locale) {
      const page = source.getPage([...slug], locale)
      return page ? toDocument(page, locale) : undefined
    },
    listDocuments(locale) {
      return source.getPages(locale).map((page) => toDocument(page, locale))
    },
    getTree(locale) {
      return source.getPageTree(locale)
    },
  }
}
