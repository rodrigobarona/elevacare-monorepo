import { defaultLocale, isLocale } from "@eleva/config/i18n"
import { creditedMedia } from "@eleva/media"
import { ElevaImage } from "@eleva/media/image"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import type { Metadata } from "next"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "credits" })
  return { title: t("title"), description: t("description") }
}

export default async function CreditsPage({ params }: Props) {
  const { locale: rawLocale } = await params
  setRequestLocale(rawLocale)
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale
  const t = await getTranslations("credits")
  const images = creditedMedia()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Section>
          <Container>
            <SectionHeader
              as="h1"
              eyebrow={t("eyebrow")}
              title={t("title")}
              lead={t("lead")}
            />
            <ul
              data-testid="photo-credits"
              className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {images.map((image) => (
                <li
                  key={image.slug}
                  className="overflow-hidden rounded-2xl border bg-card"
                >
                  <div className="relative aspect-4/3">
                    <ElevaImage
                      slug={image.slug}
                      locale={locale}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-1 p-4 text-sm">
                    <p className="font-medium text-foreground">
                      {image.credit.url ? (
                        <a
                          href={image.credit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline-offset-4 hover:underline"
                        >
                          {image.credit.name}
                        </a>
                      ) : (
                        image.credit.name
                      )}
                    </p>
                    {image.source.pageUrl ? (
                      <a
                        href={image.source.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("viewOnPexelsBy", {
                          name: image.credit.name,
                        })}
                        className="text-muted-foreground underline-offset-4 hover:underline"
                      >
                        {t("viewOnPexels")}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">{t("pexels")}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      </main>
      <SiteFooter />
    </div>
  )
}
