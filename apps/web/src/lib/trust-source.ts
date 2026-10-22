import { legalFrontmatterSchema } from "@eleva/content/schemas"
import { trust as trustCollection } from "fumadocs-mdx:collections/server"

import { createLongformLoader } from "./create-longform-loader"

type TrustCollection = Parameters<typeof createLongformLoader>[0]

export const trustLongform = createLongformLoader(
  trustCollection as TrustCollection,
  "/trust",
  legalFrontmatterSchema
)

export function getTrustMdxDocument(
  slug: string,
  locale: Parameters<typeof trustLongform.getDocument>[1]
) {
  return trustLongform.getDocument(slug, locale)
}
