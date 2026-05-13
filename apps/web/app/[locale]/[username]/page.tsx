import { cache } from "react"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { BadgeCheck, ExternalLink, Globe2, MapPin } from "lucide-react"

import type { LocalizedText } from "@eleva/db"
import {
  findClinicBySlug,
  findExpertByUsername,
  listPublicEventTypes,
  type PublicClinicProfile,
  type PublicExpertProfile,
} from "@eleva/db"
import { isReserved, validateUsername } from "@eleva/config/reserved-usernames"
import { Button } from "@eleva/ui/components/button"
import { Badge } from "@eleva/ui/components/badge"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Link } from "@/i18n/navigation"
import { EventTypeCard } from "@/components/event-type-card"
import { Section } from "@/components/section"
import { pickCategoryName, safeListCategories } from "@/lib/marketplace-helpers"

interface PageProps {
  params: Promise<{ locale: string; username: string }>
}

type ResolvedProfile =
  | { kind: "expert"; expert: PublicExpertProfile }
  | { kind: "clinic"; clinic: PublicClinicProfile }
  | null

async function resolveProfile(username: string): Promise<ResolvedProfile> {
  if (validateUsername(username) !== null) return null
  const expert = await findExpertByUsername(username)
  if (expert) return { kind: "expert", expert }
  const clinic = await findClinicBySlug(username)
  if (clinic) return { kind: "clinic", clinic }
  return null
}

const getResolvedProfile = cache(resolveProfile)

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params
  if (isReserved(username)) return { robots: "noindex" }
  const resolved = await getResolvedProfile(username)
  if (!resolved) return {}
  if (resolved.kind === "expert") {
    return {
      title: resolved.expert.displayName,
      description: resolved.expert.headline ?? resolved.expert.bio ?? undefined,
    }
  }
  return {
    title: resolved.clinic.displayName,
    description: resolved.clinic.description ?? undefined,
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { locale, username } = await params
  setRequestLocale(locale)
  const resolved = await getResolvedProfile(username)
  if (!resolved) notFound()

  if (resolved.kind === "expert") {
    const cats = await safeListCategories()
    const nameBySlug = new Map(
      cats.map((c) => [c.slug, pickCategoryName(c, locale).name])
    )
    let eventTypes: Awaited<ReturnType<typeof listPublicEventTypes>> = []
    try {
      eventTypes = await listPublicEventTypes(resolved.expert.id)
    } catch {}
    return (
      <ExpertProfile
        expert={resolved.expert}
        nameBySlug={nameBySlug}
        eventTypes={eventTypes}
        locale={locale}
      />
    )
  }
  return <ClinicProfile clinic={resolved.clinic} />
}

function lt(
  text: LocalizedText | string | null | undefined,
  locale: string
): string {
  if (!text) return ""
  if (typeof text === "string") return text
  return (text as Record<string, string>)[locale] ?? text.en ?? ""
}

async function ExpertProfile({
  expert,
  nameBySlug,
  eventTypes,
  locale,
}: {
  expert: PublicExpertProfile
  nameBySlug: ReadonlyMap<string, string>
  eventTypes: Awaited<ReturnType<typeof listPublicEventTypes>>
  locale: string
}) {
  const t = await getTranslations()

  return (
    <article className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar className="size-28 shrink-0 ring-2 ring-primary/20 sm:size-36">
          {expert.avatarUrl && <AvatarImage src={expert.avatarUrl} alt="" />}
          <AvatarFallback className="text-2xl">
            {initials(expert.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {expert.displayName}
            </h1>
            <BadgeCheck className="size-5 text-primary" />
            {expert.topExpertActive && (
              <Badge variant="secondary">
                {t("profile.expert.topExpertBadge")}
              </Badge>
            )}
          </div>
          {expert.headline && (
            <p className="mt-2 text-lg leading-relaxed text-muted-foreground">
              {expert.headline}
            </p>
          )}
          {expert.categorySlugs.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {expert.categorySlugs.map((slug) => (
                <Badge key={slug} variant="outline" className="text-xs">
                  {nameBySlug.get(slug) ?? slug}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>{t("profile.expert.aboutLabel")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {expert.bio ?? "—"}
              </p>
            </CardContent>
          </Card>

          {eventTypes.length > 0 && (
            <section id="sessions">
              <h2 className="mb-4 font-heading text-xl font-semibold text-foreground">
                {t("profile.expert.bookCta")}
              </h2>
              <div className="space-y-3">
                {eventTypes.map((et) => (
                  <EventTypeCard
                    key={et.slug}
                    username={expert.username}
                    slug={et.slug}
                    title={lt(et.title, locale)}
                    description={lt(et.description, locale) || null}
                    durationMinutes={et.durationMinutes}
                    priceAmount={et.priceAmount}
                    priceCurrency={et.currency}
                    languages={et.languages}
                    sessionMode={et.sessionMode}
                    bookLabel={t("profile.expert.bookCta")}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <FactCard
            title={t("profile.expert.languagesLabel")}
            icon={<Globe2 className="size-4 text-primary" />}
            value={expert.languages.map((l) => l.toUpperCase()).join(" · ")}
          />
          <FactCard
            title={t("profile.expert.countriesLabel")}
            icon={<MapPin className="size-4 text-primary" />}
            value={expert.practiceCountries.join(" · ")}
          />
          <FactCard
            title={t("profile.expert.sessionModesLabel")}
            value={expert.sessionModes
              .map((m) => t(`marketplace.sessionMode.${m}`))
              .join(" · ")}
          />
          {eventTypes.length > 0 && (
            <Button size="lg" className="w-full" asChild>
              <a href="#sessions">{t("profile.expert.bookCta")}</a>
            </Button>
          )}
          {eventTypes.length === 0 && (
            <>
              <Button size="lg" className="w-full" disabled>
                {t("profile.expert.bookCta")}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t("profile.expert.comingSoonNotice")}
              </p>
            </>
          )}
        </aside>
      </div>
    </article>
  )
}

async function ClinicProfile({ clinic }: { clinic: PublicClinicProfile }) {
  const t = await getTranslations()

  return (
    <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar className="size-24 shrink-0 rounded-2xl sm:size-28">
          {clinic.logoUrl && (
            <AvatarImage
              src={clinic.logoUrl}
              alt=""
              className="object-contain"
            />
          )}
          <AvatarFallback className="rounded-2xl text-xl">
            {initials(clinic.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {clinic.displayName}
          </h1>
          {clinic.description && (
            <p className="mt-2 text-lg leading-relaxed text-muted-foreground">
              {clinic.description}
            </p>
          )}
        </div>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {clinic.countryCode && (
          <FactCard
            title={t("profile.clinic.countryLabel")}
            icon={<MapPin className="size-4 text-primary" />}
            value={clinic.countryCode}
          />
        )}
        {clinic.websiteUrl && (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">
                {t("profile.clinic.websiteLabel")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const safe = safeHttpUrl(clinic.websiteUrl)
                const label = clinic.websiteUrl.replace(/^https?:\/\//, "")
                return safe ? (
                  <a
                    href={safe}
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {label}
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">{label}</span>
                )
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    </article>
  )
}

function FactCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon?: React.ReactNode
}) {
  if (!value) return null
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-xs tracking-wide text-muted-foreground uppercase">
          {title}
        </CardTitle>
        <CardDescription className="inline-flex items-center gap-2 text-sm text-foreground">
          {icon}
          {value}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "EL"
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}
