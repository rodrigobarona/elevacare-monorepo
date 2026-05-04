import { z } from "zod"

import { validateUsername } from "@eleva/config/reserved-usernames"

const APPLICANT_TYPE = ["solo_expert", "clinic_admin"] as const
export type ApplicantType = (typeof APPLICANT_TYPE)[number]

export const ALLOWED_DOC_KINDS = [
  "license",
  "id",
  "cv",
  "professional_insurance",
] as const
export type DocumentKind = (typeof ALLOWED_DOC_KINDS)[number]

const LANGUAGE_OPTIONS = ["pt", "en", "es"] as const
const COUNTRY_OPTIONS = ["PT", "ES", "BR"] as const

const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .transform((v) => v.trim().toLowerCase())
  .superRefine((value, ctx) => {
    const error = validateUsername(value)
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
      })
    }
  })

export const documentSchema = z.object({
  kind: z.enum(ALLOWED_DOC_KINDS),
  name: z.string().min(1).max(160),
  url: z.string().url().max(800),
  pathname: z.string().min(1).max(400),
  contentType: z
    .string()
    .min(1)
    .max(120)
    .regex(/^(application\/pdf|image\/(jpeg|png|webp))$/),
  size: z
    .number()
    .int()
    .nonnegative()
    .max(10 * 1024 * 1024),
})

export type ApplicationDocumentInput = z.infer<typeof documentSchema>

/**
 * Full Become-Partner submission. Validated on the server BEFORE we
 * touch the database. The form on the client uses smaller per-step
 * schemas derived from this one (omit/pick).
 */
export const becomePartnerSubmissionSchema = z.object({
  type: z.enum(APPLICANT_TYPE),
  displayName: z.string().min(2).max(120),
  username: usernameSchema,
  bio: z.string().max(600).optional().or(z.literal("")),
  nif: z.string().max(32).optional().or(z.literal("")),
  licenseNumber: z.string().max(64).optional().or(z.literal("")),
  licenseScope: z.string().max(400).optional().or(z.literal("")),
  languages: z
    .array(z.enum(LANGUAGE_OPTIONS))
    .min(1, { message: "languages-required" })
    .max(LANGUAGE_OPTIONS.length),
  practiceCountries: z
    .array(z.enum(COUNTRY_OPTIONS))
    .min(1, { message: "countries-required" })
    .max(COUNTRY_OPTIONS.length),
  categorySlugs: z
    .array(
      z
        .string()
        .min(2)
        .max(64)
        .regex(/^[a-z0-9-]+$/)
    )
    .min(1, { message: "categories-required" })
    .max(3, { message: "categories-too-many" }),
  documents: z
    .array(documentSchema)
    .min(1, { message: "license-required" })
    .superRefine((docs, ctx) => {
      const hasLicense = docs.some((d) => d.kind === "license")
      if (!hasLicense) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "license-required",
        })
      }
    }),
  consent: z.literal(true),
})

export type BecomePartnerSubmissionInput = z.infer<
  typeof becomePartnerSubmissionSchema
>

export const supportedLanguages = LANGUAGE_OPTIONS
export const supportedCountries = COUNTRY_OPTIONS
