import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { ShieldCheck, Languages, Stethoscope } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "about" })
  return { title: t("title") }
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const values: Array<{
    key: "trust" | "language" | "compliance"
    icon: React.ComponentType<{ className?: string }>
  }> = [
    { key: "trust", icon: ShieldCheck },
    { key: "language", icon: Languages },
    { key: "compliance", icon: Stethoscope },
  ]

  return (
    <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24">
      <header className="mb-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("about.title")}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          {t("about.lead")}
        </p>
      </header>

      <section className="mb-12">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {t("about.missionTitle")}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {t("about.missionBody")}
        </p>
      </section>

      <section>
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {t("about.valuesTitle")}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {values.map(({ key, icon: Icon }) => (
            <Card key={key} className="border-border/60">
              <CardHeader>
                <div className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <CardTitle>{t(`about.values.${key}.title`)}</CardTitle>
                <CardDescription>
                  {t(`about.values.${key}.body`)}
                </CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </section>
    </article>
  )
}
