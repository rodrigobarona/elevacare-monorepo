import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { ArrowRight, ShieldCheck, Globe2, Scale } from "lucide-react"

import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Link } from "@/i18n/navigation"
import { GradientHero } from "@/components/gradient-hero"
import { Section } from "@/components/section"
import { Eyebrow } from "@/components/eyebrow"
import { SectionHeading } from "@/components/section-heading"

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "about" })
  return { title: t("title"), description: t("lead") }
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("about")

  const values = [
    { key: "trust" as const, icon: ShieldCheck },
    { key: "language" as const, icon: Globe2 },
    { key: "compliance" as const, icon: Scale },
  ]

  return (
    <>
      <GradientHero
        eyebrow={t("title")}
        title={t("title")}
        subtitle={t("lead")}
      />

      <Section>
        <SectionHeading>{t("missionTitle")}</SectionHeading>
        <p className="mt-6 max-w-prose text-base leading-relaxed text-muted-foreground">
          {t("missionBody")}
        </p>
      </Section>

      <Section className="bg-muted/30">
        <Eyebrow>{t("valuesTitle")}</Eyebrow>
        <SectionHeading className="mt-3">{t("valuesTitle")}</SectionHeading>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {values.map(({ key, icon: Icon }) => (
            <Card key={key} className="border-border/60">
              <CardHeader>
                <div className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <CardTitle>{t(`values.${key}.title`)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`values.${key}.body`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-3xl border border-border/60 bg-eleva-secondary-light/20 p-10 text-center">
            <SectionHeading>
              {locale === "pt"
                ? "Junte-se à Eleva.care"
                : locale === "es"
                  ? "Únase a Eleva.care"
                  : "Join Eleva.care"}
            </SectionHeading>
            <div className="mt-6 flex justify-center">
              <Button size="lg" asChild>
                <Link href="/become-partner">
                  {locale === "pt"
                    ? "Candidatar-se"
                    : locale === "es"
                      ? "Aplicar"
                      : "Apply to become a partner"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
