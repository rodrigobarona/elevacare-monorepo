import { cache } from "react"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { Clock, Globe2, Video, MapPin, Phone, BadgeCheck } from "lucide-react"

import { findExpertByUsername, findPublicEventType } from "@eleva/db"
import { Badge } from "@eleva/ui/components/badge"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Link } from "@/i18n/navigation"
import { SectionHeading } from "@/components/section-heading"
import { SlotPicker } from "./slot-picker"

interface PageProps {
  params: Promise<{ locale: string; username: string; event: string }>
}

const getExpert = cache(async (username: string) => {
  return findExpertByUsername(username)
})

const getEvent = cache(async (expertId: string, slug: string) => {
  return findPublicEventType(expertId, slug)
})

function localizedText(
  text: Record<string, string> | string | null | undefined,
  locale: string
): string {
  if (!text) return ""
  if (typeof text === "string") return text
  return text[locale] ?? text.en ?? ""
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, username, event: eventSlug } = await params
  const expert = await getExpert(username)
  if (!expert) return {}
  const eventType = await getEvent(expert.id, eventSlug)
  if (!eventType) return {}
  const title = localizedText(eventType.title, locale)
  return {
    title: `${title} · ${expert.displayName}`,
    description: localizedText(eventType.description, locale) || undefined,
  }
}

const modeIcons: Record<string, typeof Video> = {
  online: Video,
  in_person: MapPin,
  phone: Phone,
}

export default async function EventPage({ params }: PageProps) {
  const { locale, username, event: eventSlug } = await params
  setRequestLocale(locale)

  const expert = await getExpert(username)
  if (!expert) notFound()

  const eventType = await getEvent(expert.id, eventSlug)
  if (!eventType) notFound()

  const t = await getTranslations()
  const ModeIcon = modeIcons[eventType.sessionMode] ?? Video
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const evTitle = localizedText(eventType.title, locale)
  const evDesc = localizedText(eventType.description, locale)

  return (
    <article className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
      <nav
        className="mb-6 text-sm text-muted-foreground"
        aria-label="Breadcrumb"
      >
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href={`/${username}`} className="hover:text-foreground">
              {expert.displayName}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground" aria-current="page">
            {evTitle}
          </li>
        </ol>
      </nav>

      <SectionHeading as="h1">{evTitle}</SectionHeading>
      {evDesc && (
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          {evDesc}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1 text-xs">
          <Clock className="size-3" />
          {eventType.durationMinutes} min
        </Badge>
        <Badge variant="outline" className="gap-1 text-xs">
          <ModeIcon className="size-3" />
          {t(`marketplace.sessionMode.${eventType.sessionMode}`)}
        </Badge>
        {eventType.languages.length > 0 && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Globe2 className="size-3" />
            {eventType.languages.map((l: string) => l.toUpperCase()).join(", ")}
          </Badge>
        )}
        <Badge className="text-xs font-semibold">
          {new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: eventType.currency,
          }).format(eventType.priceAmount / 100)}
        </Badge>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_280px]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>{t("slotPicker.heading")}</CardTitle>
          </CardHeader>
          <CardContent>
            <SlotPicker
              username={username}
              eventSlug={eventSlug}
              durationMinutes={eventType.durationMinutes}
              timezone={tz}
            />
          </CardContent>
        </Card>

        <aside className="hidden lg:block">
          <Card className="sticky top-24 border-border/60">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  {expert.avatarUrl && (
                    <AvatarImage src={expert.avatarUrl} alt="" />
                  )}
                  <AvatarFallback className="text-sm">
                    {initials(expert.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-semibold text-foreground">
                      {expert.displayName}
                    </p>
                    <BadgeCheck className="size-3.5 text-primary" />
                  </div>
                  <Link
                    href={`/${username}`}
                    className="text-xs text-primary hover:underline"
                  >
                    {t("marketplace.card.viewProfile")}
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </article>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "EL"
}
