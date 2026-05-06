import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { findExpertByUsername, findPublicEventType } from "@eleva/db"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Badge } from "@eleva/ui/components/badge"
import { SlotPicker } from "./slot-picker"

type LocalizedText = { en: string; pt?: string; es?: string }

interface PageProps {
  params: Promise<{ locale: string; username: string; event: string }>
}

function pickText(text: LocalizedText, locale: string): string {
  if (locale === "pt" && text.pt) return text.pt
  if (locale === "es" && text.es) return text.es
  return text.en
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, username, event: eventSlug } = await props.params
  const expert = await findExpertByUsername(username)
  if (!expert) return { title: "Not Found" }

  const eventType = await findPublicEventType(expert.id, eventSlug)
  if (!eventType) return { title: "Not Found" }

  const title = pickText(eventType.title as LocalizedText, locale)

  return {
    title: `Book ${title} with ${expert.displayName} — Eleva.care`,
    description: eventType.description
      ? pickText(eventType.description as LocalizedText, locale)
      : `Book a ${eventType.durationMinutes}-minute ${title} session with ${expert.displayName}`,
  }
}

export default async function BookingPage(props: PageProps) {
  const { headers } = await import("next/headers")
  const { locale, username, event: eventSlug } = await props.params

  const expert = await findExpertByUsername(username)
  if (!expert) notFound()

  const eventType = await findPublicEventType(expert.id, eventSlug)
  if (!eventType) notFound()

  const h = await headers()
  const ssrTz = h.get("x-vercel-ip-timezone") ?? "UTC"

  const title = pickText(eventType.title as LocalizedText, locale)
  const description = eventType.description
    ? pickText(eventType.description as LocalizedText, locale)
    : null

  const priceDisplay =
    eventType.priceAmount > 0
      ? new Intl.NumberFormat(locale, {
          style: "currency",
          currency: eventType.currency,
        }).format(eventType.priceAmount / 100)
      : "Free"

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {expert.displayName}
              </p>
              <CardTitle className="text-2xl">{title}</CardTitle>
              {description && (
                <p className="text-muted-foreground">{description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="secondary">
                {eventType.sessionMode.replace("_", " ")}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span>{eventType.durationMinutes} min</span>
            <span>{priceDisplay}</span>
            <span>
              {(eventType.languages as string[])
                .map((l) => l.toUpperCase())
                .join(", ")}
            </span>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">Select a time</h2>
        <SlotPicker
          username={username}
          eventSlug={eventSlug}
          durationMinutes={eventType.durationMinutes}
          timezone={ssrTz}
        />
      </section>
    </div>
  )
}
