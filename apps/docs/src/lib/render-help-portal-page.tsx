import { isContentLocale, type ContentLocale } from "@eleva/content/locales"
import { getMdxComponents } from "@eleva/content/mdx-components"
import { TableOfContents } from "@eleva/content/toc"
import { notFound } from "next/navigation"
import { DocsChrome } from "@/components/docs-chrome"
import { DocsSidebar } from "@/components/docs-sidebar"
import {
  getHelpDocument,
  getHelpLoader,
  type HelpPortalId,
} from "@/lib/help-source"
import { getDocsChromeCopy } from "@/lib/docs-chrome-copy"
import { docsLocalePrefix } from "@/lib/locale-prefix"

export async function renderHelpPortalPage({
  portal,
  locale,
  slug,
}: {
  portal: HelpPortalId
  locale: string
  slug?: string[]
}) {
  if (!isContentLocale(locale)) {
    notFound()
  }
  const contentLocale: ContentLocale = locale
  const slugParts = slug?.length ? slug : []
  let doc = getHelpDocument(portal, slugParts, contentLocale)
  if (!doc && slugParts.length === 0) {
    doc = getHelpDocument(portal, ["index"], contentLocale)
  }
  if (!doc) {
    notFound()
  }

  const tree = getHelpLoader(portal).getTree(contentLocale)
  const localePrefix = docsLocalePrefix(contentLocale)
  const copy = getDocsChromeCopy(contentLocale)
  const components = getMdxComponents()
  const Body = doc.Body

  return (
    <DocsChrome locale={contentLocale} localePrefix={localePrefix}>
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[240px_minmax(0,1fr)_200px]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <DocsSidebar tree={tree} title={copy.helpTopics} />
          </div>
        </aside>
        <article className="max-w-3xl min-w-0 lg:max-w-none">
          <h1 className="text-3xl font-bold tracking-tight">
            {doc.frontmatter.title}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {doc.frontmatter.description}
          </p>
          <div className="longform-prose mt-8 text-base text-foreground/90">
            <Body components={components} />
          </div>
        </article>
        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <TableOfContents items={doc.toc} title={copy.onThisPage} />
          </div>
        </aside>
      </div>
    </DocsChrome>
  )
}
