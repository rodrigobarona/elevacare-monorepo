import { getTranslations, setRequestLocale } from "next-intl/server"
import { ArrowRight, Search, CalendarCheck, Video } from "lucide-react"

import { listCategories, listExperts } from "@eleva/db"
import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Link } from "@/i18n/navigation"
import { GradientHero } from "@/components/gradient-hero"
import { TrustStrip } from "@/components/trust-strip"
import { Section } from "@/components/section"
import { Eyebrow } from "@/components/eyebrow"
import { SectionHeading } from "@/components/section-heading"
import { CategoryCard } from "@/components/category-card"
import { ExpertCard } from "@/components/expert-card"
import { AudienceSplit } from "@/components/audience-split"

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const [categories, allExperts] = await Promise.all([
    safeQuery(() => listCategories()),
    safeQuery(() => listExperts({ pageSize: 24, locale })),
  ])

  const featuredExperts =
    allExperts?.experts.filter((e) => e.topExpertActive).slice(0, 8) ?? []

  return (
    <>
      <GradientHero
        variant="split"
        eyebrow={t("home.hero.eyebrow")}
        title={
          <>
            {t("home.hero.title").split(",")[0]},
            <strong>{t("home.hero.title").split(",")[1]}</strong>
          </>
        }
        subtitle={t("home.hero.subtitle")}
        imageSrc="/img/lifestyle/Smiling-Women-Photo.jpg"
        imageAlt=""
        actions={
          <>
            <Button size="lg" asChild>
              <Link href="/experts">
                {t("home.hero.ctaPrimary")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/become-partner">{t("home.hero.ctaSecondary")}</Link>
            </Button>
          </>
        }
        trust={
          <TrustStrip
            items={[
              { icon: "shield", label: t("home.hero.trustEN") },
              { icon: "clock", label: t("home.hero.trustOnline") },
            ]}
          />
        }
      />

      <Section>
        <Eyebrow>{t("home.valueProps.title")}</Eyebrow>
        <SectionHeading className="mt-3">
          {t("home.valueProps.title")}
        </SectionHeading>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {(["trust", "languages", "instant"] as const).map((key) => (
            <Card key={key} className="border-border/60">
              <CardHeader>
                <CardTitle>{t(`home.valueProps.items.${key}.title`)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`home.valueProps.items.${key}.body`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {categories && categories.length > 0 && (
        <Section className="bg-muted/30">
          <div className="flex items-end justify-between gap-4">
            <div className="max-w-2xl">
              <Eyebrow>{t("home.categories.subtitle")}</Eyebrow>
              <SectionHeading className="mt-3">
                {t("home.categories.title")}
              </SectionHeading>
            </div>
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/experts">
                {t("home.categories.viewAll")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories!.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <CategoryCard
                  slug={c.slug}
                  name={c.displayName[locale] ?? c.displayName.en}
                  description={
                    c.description?.[locale] ?? c.description?.en ?? null
                  }
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section>
        <Eyebrow>
          {locale === "pt"
            ? "Como funciona"
            : locale === "es"
              ? "Cómo funciona"
              : "How it works"}
        </Eyebrow>
        <SectionHeading className="mt-3">
          {locale === "pt"
            ? "Três passos simples"
            : locale === "es"
              ? "Tres pasos sencillos"
              : "Three simple steps"}
        </SectionHeading>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          <HowItWorksStep
            number="1"
            icon={<Search className="size-6" />}
            title={
              locale === "pt"
                ? "Descubra um especialista"
                : locale === "es"
                  ? "Descubra un especialista"
                  : "Discover an expert"
            }
            body={
              locale === "pt"
                ? "Explore perfis verificados por especialidade, idioma ou país."
                : locale === "es"
                  ? "Explore perfiles verificados por especialidad, idioma o país."
                  : "Browse verified profiles by specialty, language, or country."
            }
          />
          <HowItWorksStep
            number="2"
            icon={<CalendarCheck className="size-6" />}
            title={
              locale === "pt"
                ? "Agende uma sessão"
                : locale === "es"
                  ? "Agende una sesión"
                  : "Book a session"
            }
            body={
              locale === "pt"
                ? "Escolha um horário que funcione para si e pague com segurança."
                : locale === "es"
                  ? "Elija un horario y pague de forma segura."
                  : "Pick a time that works for you and pay securely."
            }
          />
          <HowItWorksStep
            number="3"
            icon={<Video className="size-6" />}
            title={
              locale === "pt"
                ? "Tenha a sua consulta"
                : locale === "es"
                  ? "Realice su consulta"
                  : "Meet & follow up"
            }
            body={
              locale === "pt"
                ? "Encontre-se por vídeo e receba acompanhamento personalizado."
                : locale === "es"
                  ? "Reúnase por video y reciba seguimiento personalizado."
                  : "Connect via video and get personalised follow-up."
            }
          />
        </div>
      </Section>

      {featuredExperts.length > 0 && (
        <Section className="bg-muted/30">
          <div className="flex items-end justify-between gap-4">
            <div>
              <Eyebrow>
                {locale === "pt"
                  ? "Especialistas verificados"
                  : locale === "es"
                    ? "Especialistas verificados"
                    : "Top experts"}
              </Eyebrow>
              <SectionHeading className="mt-3">
                {locale === "pt"
                  ? "Verificados e prontos para si"
                  : locale === "es"
                    ? "Verificados y listos para usted"
                    : "Verified experts, ready when you are"}
              </SectionHeading>
            </div>
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/experts">
                {t("home.categories.viewAll")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featuredExperts.map((expert) => (
              <ExpertCard
                key={expert.username}
                expert={expert}
                labels={{
                  topExpert: t("marketplace.card.topExpert"),
                  languagesLabel: t("marketplace.card.languagesLabel"),
                  countriesLabel: t("marketplace.card.countriesLabel"),
                  viewProfile: t("marketplace.card.viewProfile"),
                  sessionMode: {
                    online: t("marketplace.sessionMode.online"),
                    in_person: t("marketplace.sessionMode.in_person"),
                    phone: t("marketplace.sessionMode.phone"),
                  },
                }}
              />
            ))}
          </div>
        </Section>
      )}

      <Section>
        <AudienceSplit
          items={[
            {
              title:
                locale === "pt"
                  ? "Procuro cuidado"
                  : locale === "es"
                    ? "Busco atención"
                    : "I need care",
              body:
                locale === "pt"
                  ? "Encontre especialistas verificados na sua língua."
                  : locale === "es"
                    ? "Encuentre especialistas verificados en su idioma."
                    : "Find verified experts in your language.",
              href: "/experts",
              cta: t("home.hero.ctaPrimary"),
            },
            {
              title:
                locale === "pt"
                  ? "Sou profissional"
                  : locale === "es"
                    ? "Soy profesional"
                    : "I'm a professional",
              body:
                locale === "pt"
                  ? "Junte-se ao marketplace e alcance pacientes."
                  : locale === "es"
                    ? "Únase al marketplace y alcance pacientes."
                    : "Join the marketplace and reach patients.",
              href: "/become-partner",
              cta: t("home.hero.ctaSecondary"),
            },
            {
              title:
                locale === "pt"
                  ? "Represento uma clínica"
                  : locale === "es"
                    ? "Represento una clínica"
                    : "I represent a clinic",
              body:
                locale === "pt"
                  ? "Gira a sua equipa e receba pacientes online."
                  : locale === "es"
                    ? "Gestione su equipo y reciba pacientes online."
                    : "Manage your team and receive patients online.",
              href: "/become-partner",
              cta: t("home.hero.ctaSecondary"),
            },
          ]}
        />
      </Section>

      <section className="bg-eleva-secondary-light/30 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-3xl border border-border/60 bg-background p-10 text-center">
            <SectionHeading>{t("home.becomePartner.title")}</SectionHeading>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              {t("home.becomePartner.body")}
            </p>
            <div className="mt-6 flex justify-center">
              <Button size="lg" asChild>
                <Link href="/become-partner">
                  {t("home.becomePartner.cta")}
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

function HowItWorksStep({
  number,
  icon,
  title,
  body,
}: {
  number: string
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="font-mono text-xs font-medium text-primary">{number}</p>
      <h3 className="mt-1 font-heading text-lg font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  )
}

async function safeQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch {
    return null
  }
}
