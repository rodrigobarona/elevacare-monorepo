import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
} from "fumadocs-mdx/config"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fumadocs collection type is not portable across Zod versions
export const legal: any = defineDocs({
  dir: "../../packages/content/content/legal",
  docs: {
    schema: frontmatterSchema,
  },
})

export const trust: any = defineDocs({
  dir: "../../packages/content/content/trust",
  docs: {
    schema: frontmatterSchema,
  },
})

export const pages: any = defineDocs({
  dir: "../../packages/content/content/pages",
  docs: {
    schema: frontmatterSchema,
  },
})

export default defineConfig()
