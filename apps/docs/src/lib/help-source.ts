import { createFumadocsContentLoader } from "@eleva/content/loader"
import type { ContentLocale } from "@eleva/content/locales"
import { helpFrontmatterSchema } from "@eleva/content/schemas"
import { loader } from "fumadocs-core/source"
import {
  helpClinics as helpClinicsCollection,
  helpExperts as helpExpertsCollection,
  helpMembers as helpMembersCollection,
} from "fumadocs-mdx:collections/server"

import { contentI18n } from "./content-i18n"

type HelpCollection = {
  toFumadocsSource: () => Parameters<typeof loader>[0]["source"]
}

export const HELP_PORTAL_IDS = ["members", "experts", "clinics"] as const
export type HelpPortalId = (typeof HELP_PORTAL_IDS)[number]

const collections: Record<HelpPortalId, HelpCollection> = {
  members: helpMembersCollection as HelpCollection,
  experts: helpExpertsCollection as HelpCollection,
  clinics: helpClinicsCollection as HelpCollection,
}

function createHelpLoader(portal: HelpPortalId, collection: HelpCollection) {
  const base = loader({
    i18n: contentI18n,
    baseUrl: `/${portal}`,
    source: collection.toFumadocsSource(),
  })
  return createFumadocsContentLoader(base, helpFrontmatterSchema)
}

const loaders = {
  members: createHelpLoader("members", collections.members),
  experts: createHelpLoader("experts", collections.experts),
  clinics: createHelpLoader("clinics", collections.clinics),
} as const

export function getHelpLoader(portal: HelpPortalId) {
  return loaders[portal]
}

export function getHelpDocument(
  portal: HelpPortalId,
  slug: string[],
  locale: ContentLocale
) {
  return getHelpLoader(portal).getDocument(slug, locale)
}

export function listHelpSlugs(portal: HelpPortalId, locale: ContentLocale) {
  return getHelpLoader(portal)
    .listDocuments(locale)
    .map((doc) => doc.slug.filter(Boolean))
}
