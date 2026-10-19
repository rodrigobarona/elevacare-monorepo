import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import { ArrowRightIcon } from "@eleva/icons"
import { ElevaImage } from "@eleva/media/image"
import { CtaBand } from "@eleva/ui/blocks/cta-band"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Accent, Heading } from "@eleva/ui/components/typography"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { hreflangLanguages, localePath } from "@/lib/hreflang"
import type { Metadata } from "next"

type Props = {
  params: Promise<{ locale: string }>
}

type LetterSection = { title: string; paragraphs: string[] }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "history" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: localePath(locale, "/history"),
      languages: hreflangLanguages("/history"),
    },
  }
}

export default async function HistoryPage({ params }: Props) {
  const { locale: requestLocale } = await params
  setRequestLocale(requestLocale)
  const locale: Locale = isLocale(requestLocale) ? requestLocale : defaultLocale
  const t = await getTranslations("history")
  const sections = t.raw("sections") as LetterSection[]

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Section spacing="compact" className="pt-20 sm:pt-28">
          <Container size="narrow" className="flex flex-col gap-10">
            <SectionHeader
              as="h1"
              align="center"
              eyebrow={t("eyebrow")}
              title={
                <>
                  {t("heading")}
                  <Accent>{t("headingAccent")}</Accent>
                </>
              }
              lead={t("lead")}
            />
            <div className="flex items-center justify-center gap-3">
              <div className="relative size-12 overflow-hidden rounded-full bg-muted">
                <ElevaImage
                  slug="team-patricia-mota"
                  locale={locale}
                  decorative
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div>
                <p className="font-medium text-foreground">{t("author")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("authorRole")}
                </p>
              </div>
            </div>
          </Container>
        </Section>

        <Section spacing="none">
          <Container size="wide">
            <figure className="flex flex-col gap-3">
              <div className="relative aspect-3/2 overflow-hidden rounded-4xl shadow-2">
                <ElevaImage
                  slug="founders-photo"
                  locale={locale}
                  fill
                  priority
                  sizes="(min-width: 1280px) 1200px, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="text-center text-sm text-muted-foreground">
                {t("photoCaption")}
              </figcaption>
            </figure>
          </Container>
        </Section>

        <Section>
          <Container size="narrow">
            <article className="flex flex-col gap-12">
              {sections.map((section, index) => (
                <section key={section.title} className="flex flex-col gap-5">
                  <Heading as="h2" size="title">
                    {section.title}
                  </Heading>
                  {section.paragraphs.map((_, paragraph) => (
                    <p
                      key={paragraph}
                      className="text-lg leading-relaxed text-pretty text-muted-foreground"
                    >
                      {t.rich(`sections.${index}.paragraphs.${paragraph}`, {
                        b: (chunks) => (
                          <strong className="font-medium text-foreground">
                            {chunks}
                          </strong>
                        ),
                      })}
                    </p>
                  ))}
                </section>
              ))}
              <footer className="flex flex-col gap-1 border-t pt-8">
                <p className="font-heading text-lg text-muted-foreground italic">
                  {t("signOff")}
                </p>
                <p className="font-medium text-foreground">{t("author")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("authorRole")}
                </p>
              </footer>
            </article>
          </Container>
        </Section>

        <Section spacing="compact" className="pb-24">
          <Container>
            <CtaBand
              eyebrow={t("cta.eyebrow")}
              title={t("cta.heading")}
              actions={
                <Link
                  href="/experts"
                  className={buttonVariants({ variant: "inverse", size: "lg" })}
                >
                  {t("cta.action")}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              }
            />
          </Container>
        </Section>
      </main>
      <SiteFooter />
    </div>
  )
}
