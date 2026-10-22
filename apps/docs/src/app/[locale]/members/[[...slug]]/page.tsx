import { CONTENT_LOCALES } from "@eleva/content/locales"
import type { Metadata } from "next"
import { getHelpDocument, listHelpSlugs } from "@/lib/help-source"
import { renderHelpPortalPage } from "@/lib/render-help-portal-page"

type Props = {
  params: Promise<{ locale: string; slug?: string[] }>
}

const PORTAL = "members" as const

export function generateStaticParams() {
  const params: { locale: string; slug?: string[] }[] = []
  for (const locale of CONTENT_LOCALES) {
    const slugs = listHelpSlugs(PORTAL, locale)
    if (slugs.length === 0) {
      params.push({ locale, slug: undefined })
      continue
    }
    for (const slug of slugs) {
      const isIndex =
        slug.length === 0 ||
        (slug.length === 1 && (slug[0] === "index" || slug[0] === ""))
      params.push({ locale, slug: isIndex ? undefined : slug })
    }
  }
  return params
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!(CONTENT_LOCALES as readonly string[]).includes(locale)) return {}
  const slugParts = slug?.length ? slug : []
  const doc =
    getHelpDocument(
      PORTAL,
      slugParts,
      locale as (typeof CONTENT_LOCALES)[number]
    ) ??
    getHelpDocument(
      PORTAL,
      ["index"],
      locale as (typeof CONTENT_LOCALES)[number]
    )
  if (!doc) return {}
  return {
    title: `${doc.frontmatter.title} — Eleva help`,
    description: doc.frontmatter.description,
  }
}

export default async function MembersHelpPage({ params }: Props) {
  const { locale, slug } = await params
  return renderHelpPortalPage({ portal: PORTAL, locale, slug })
}
