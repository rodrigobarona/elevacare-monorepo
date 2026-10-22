import { CONTENT_LOCALES } from "@eleva/content/locales"
import Link from "next/link"
import type { Metadata } from "next"
import { DocsChrome } from "@/components/docs-chrome"
import { docsLocalePrefix } from "@/lib/locale-prefix"

type Props = {
  params: Promise<{ locale: string }>
}

const PORTALS = [
  {
    id: "members",
    title: "Members",
    description: "Book sessions, pay securely, and manage your care on Eleva.",
  },
  {
    id: "experts",
    title: "Experts",
    description:
      "Set up your practice, publish services, and get paid via Stripe.",
  },
  {
    id: "clinics",
    title: "Clinics",
    description: "Run a Team clinic with shared scheduling and payouts.",
  },
] as const

export function generateStaticParams() {
  return CONTENT_LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return {
    title: "Help center — Eleva.care",
    description:
      "Guides for members, experts, and clinic teams using Eleva.care.",
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

  return (
    <DocsChrome locale={locale} localePrefix={localePrefix}>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight">Help center</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Choose your portal for step-by-step guides on booking, practising, and
          running a clinic on Eleva.care.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {PORTALS.map((portal) => (
            <li key={portal.id}>
              <Link
                href={`${localePrefix}/${portal.id}`}
                className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
              >
                <span className="font-semibold">{portal.title}</span>
                <span className="mt-2 text-sm text-muted-foreground">
                  {portal.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-muted-foreground">
          Machine-readable index:{" "}
          <a href="/docs/llms.txt" className="underline underline-offset-2">
            llms.txt
          </a>
        </p>
      </div>
    </DocsChrome>
  )
}
