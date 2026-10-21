import { createFumadocsContentLoader } from "@eleva/content/loader"
import type { ContentLocale } from "@eleva/content/locales"
import { legalFrontmatterSchema } from "@eleva/content/schemas"
import { loader } from "fumadocs-core/source"
import { legal as legalCollection } from "fumadocs-mdx:collections/server"

import { contentI18n } from "./content-i18n"

type LegalCollection = {
  toFumadocsSource: () => Parameters<typeof loader>[0]["source"]
}

const legal = legalCollection as LegalCollection

const legalBase = loader({
  i18n: contentI18n,
  baseUrl: "/legal",
  source: legal.toFumadocsSource(),
})

export const legalContent = createFumadocsContentLoader(
  legalBase,
  legalFrontmatterSchema
)

export function getLegalMdxDocument(slug: string, locale: ContentLocale) {
  return legalContent.getDocument([slug], locale)
}

export function listLegalMdxSlugs(locale: ContentLocale): string[] {
  return legalContent
    .listDocuments(locale)
    .map((doc) => doc.slug.at(-1))
    .filter((s): s is string => Boolean(s))
}
