import { CONTENT_LOCALES } from "@eleva/content/locales"
import Link from "next/link"
import type { Metadata } from "next"
import { DocsChrome } from "@/components/docs-chrome"
import { getDocsChromeCopy } from "@/lib/docs-chrome-copy"
import { docsLocalePrefix } from "@/lib/locale-prefix"

type Props = {
  params: Promise<{ locale: string }>
}

const PORTALS = ["members", "experts", "clinics"] as const

export function generateStaticParams() {
  return CONTENT_LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const copy = getDocsChromeCopy(locale)
  return {
    title: `${copy.helpCenter} — Eleva Care`,
    description: copy.hubDescription,
    alternates: {
      canonical: locale === "en" ? "/docs" : `/docs/${locale}`,
    },
  }
}

export default async function DocsHubPage({ params }: Props) {
  const { locale } = await params
  const localePrefix = docsLocalePrefix(
    locale as (typeof CONTENT_LOCALES)[number]
  )
  const copy = getDocsChromeCopy(locale)

  return (
    <DocsChrome locale={locale} localePrefix={localePrefix}>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight">{copy.helpCenter}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{copy.hubIntro}</p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {PORTALS.map((portal) => (
            <li key={portal}>
              <Link
                href={`${localePrefix}/${portal}`}
                className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
              >
                <span className="font-semibold">{copy.portals[portal]}</span>
                <span className="mt-2 text-sm text-muted-foreground">
                  {copy.portalDescriptions[portal]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-muted-foreground">
          {copy.machineIndex}{" "}
          <a href="/docs/llms.txt" className="underline underline-offset-2">
            llms.txt
          </a>
        </p>
      </div>
    </DocsChrome>
  )
}
