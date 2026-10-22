import { pages as pagesCollection } from "fumadocs-mdx:collections/server"
import { pageFrontmatterSchema } from "@eleva/content/schemas"

import { createLongformLoader } from "./create-longform-loader"

type PagesCollection = Parameters<typeof createLongformLoader>[0]

export const pagesLongform = createLongformLoader(
  pagesCollection as PagesCollection,
  "",
  pageFrontmatterSchema
)

export function getPageMdxDocument(
  slug: string,
  locale: Parameters<typeof pagesLongform.getDocument>[1]
) {
  return pagesLongform.getDocument(slug, locale)
}
