import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
} from "fumadocs-mdx/config"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fumadocs collection type is not portable across Zod versions
export const helpMembers: any = defineDocs({
  dir: "../../packages/content/content/help/members",
  docs: { schema: frontmatterSchema },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const helpExperts: any = defineDocs({
  dir: "../../packages/content/content/help/experts",
  docs: { schema: frontmatterSchema },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const helpClinics: any = defineDocs({
  dir: "../../packages/content/content/help/clinics",
  docs: { schema: frontmatterSchema },
})

export default defineConfig()
