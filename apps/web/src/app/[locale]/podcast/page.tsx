import { getEditorialPillars } from "@eleva/config/editorial-pillars"
import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { PillarPage } from "@/components/pillar-page"
import { hreflangLanguages, localePath } from "@/lib/hreflang"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "pillars.podcast" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: localePath(locale, "/podcast"),
      languages: hreflangLanguages("/podcast"),
    },
  }
}

export default async function PodcastPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "pillars.podcast" })
  const { podcast } = getEditorialPillars()

  const secondaryLinks: { href: string; label: string; external: boolean }[] =
    []
  if (podcast.spotify) {
    secondaryLinks.push({
      href: podcast.spotify,
      label: t("spotify"),
      external: true,
    })
  }
  if (podcast.apple) {
    secondaryLinks.push({
      href: podcast.apple,
      label: t("apple"),
      external: true,
    })
  }
  if (podcast.youtube) {
    secondaryLinks.push({
      href: podcast.youtube,
      label: t("youtube"),
      external: true,
    })
  }

  return (
    <PillarPage
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      body={t("body")}
      secondaryLinks={
        secondaryLinks.length > 0
          ? secondaryLinks
          : [
              {
                href: "/newsletter",
                label: t("newsletterFallback"),
                external: false,
              },
            ]
      }
    />
  )
}
