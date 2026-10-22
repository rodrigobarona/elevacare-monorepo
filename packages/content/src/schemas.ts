import { z } from "zod"

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO calendar date (YYYY-MM-DD)")

/** Fields shared by every long-form document. */
export const baseFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  noindex: z.boolean().default(false),
})

/**
 * Legal and trust documents. `lastUpdated` is the date the text last
 * changed; the consent version (`CONSENT_DOCUMENT_VERSION`) is rendered
 * by the page, not duplicated in each file.
 */
export const legalFrontmatterSchema = baseFrontmatterSchema.extend({
  lastUpdated: isoDate,
  summary: z.string().min(1).optional(),
})

export const pageFrontmatterSchema = baseFrontmatterSchema.extend({
  lastUpdated: isoDate,
  summary: z.string().min(1).optional(),
  eyebrow: z.string().min(1).optional(),
})

export const HELP_AUDIENCES = ["members", "experts", "clinics"] as const
export type HelpAudience = (typeof HELP_AUDIENCES)[number]

export const helpFrontmatterSchema = baseFrontmatterSchema.extend({
  /** Locale text drafted by AI and awaiting a native-speaker pass. */
  machineTranslated: z.boolean().default(false),
})

/** Folder `meta.json` used by the help page tree. */
export const helpMetaSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  pages: z.array(z.string()).optional(),
  defaultOpen: z.boolean().optional(),
  root: z.boolean().optional(),
})

export type LegalFrontmatter = z.infer<typeof legalFrontmatterSchema>
export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>
export type HelpFrontmatter = z.infer<typeof helpFrontmatterSchema>
export type HelpMeta = z.infer<typeof helpMetaSchema>

export const CONTENT_COLLECTIONS = {
  legal: legalFrontmatterSchema,
  trust: legalFrontmatterSchema,
  pages: pageFrontmatterSchema,
  help: helpFrontmatterSchema,
} as const

export type ContentCollection = keyof typeof CONTENT_COLLECTIONS
