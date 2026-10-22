import { defineConfig, defineDocs } from "fumadocs-mdx/config"
import {
  legalFrontmatterSchema,
  pageFrontmatterSchema,
} from "@eleva/content/schemas"

// Collections carry the shared `@eleva/content` frontmatter schemas so fields
// such as `lastUpdated` reach the pages (Fumadocs' default schema strips them).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fumadocs collection type is not portable across Zod versions
export const legal: any = defineDocs({
  dir: "../../packages/content/content/legal",
  docs: { schema: legalFrontmatterSchema },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trust: any = defineDocs({
  dir: "../../packages/content/content/trust",
  docs: { schema: legalFrontmatterSchema },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pages: any = defineDocs({
  dir: "../../packages/content/content/pages",
  docs: { schema: pageFrontmatterSchema },
})

export default defineConfig()
