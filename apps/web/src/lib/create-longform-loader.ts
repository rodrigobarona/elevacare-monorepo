import { createFumadocsContentLoader } from "@eleva/content/loader"
import type { ContentLocale } from "@eleva/content/locales"
import { legalFrontmatterSchema } from "@eleva/content/schemas"
import { loader } from "fumadocs-core/source"
import type { z } from "zod"

import { contentI18n } from "./content-i18n"

type FumadocsCollection = {
  toFumadocsSource: () => Parameters<typeof loader>[0]["source"]
}

export function createLongformLoader<TSchema extends z.ZodType>(
  collection: FumadocsCollection,
  baseUrl: string,
  schema: TSchema
) {
  const base = loader({
    i18n: contentI18n,
    baseUrl,
    source: collection.toFumadocsSource(),
  })

  const content = createFumadocsContentLoader(base, schema)

  return {
    getDocument(slug: string, locale: ContentLocale) {
      return content.getDocument([slug], locale)
    },
    listSlugs(locale: ContentLocale) {
      return content
        .listDocuments(locale)
        .map((doc) => doc.slug.at(-1))
        .filter((s): s is string => Boolean(s))
    },
  }
}
