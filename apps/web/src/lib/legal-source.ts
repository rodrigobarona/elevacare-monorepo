import type { ContentLocale } from "@eleva/content/locales"
import { legalFrontmatterSchema } from "@eleva/content/schemas"
import { legal as legalCollection } from "fumadocs-mdx:collections/server"

import { createLongformLoader } from "./create-longform-loader"

type LegalCollection = Parameters<typeof createLongformLoader>[0]

export const legalLongform = createLongformLoader(
  legalCollection as LegalCollection,
  "/legal",
  legalFrontmatterSchema
)

export function getLegalMdxDocument(slug: string, locale: ContentLocale) {
  return legalLongform.getDocument(slug, locale)
}
