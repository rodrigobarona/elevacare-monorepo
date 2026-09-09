import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ApiClientError } from "@eleva/api-client"
import { isReserved } from "@eleva/config/reserved-usernames"
import { SiteHeader } from "@/components/site-header"
import { formatEur } from "@/lib/format-eur"
import { hreflangLanguages } from "@/lib/hreflang"
import { pickLocalizedText } from "@/lib/localized-text"
import { createPublicApiClient } from "@/lib/public-api"

type Props = {
  params: Promise<{ locale: string; username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, username } = await params
  if (isReserved(username)) {
    return {}
  }
  try {
    const expert = await createPublicApiClient().public.getExpert(username)
    const t = await getTranslations({ locale, namespace: "profile" })
    const path = `/${expert.username}`
    return {
      title: t("title", { name: expert.displayName }),
      description:
        expert.headline ?? t("description", { name: expert.displayName }),
      alternates: {
        canonical: locale === "en" ? path : `/${locale}${path}`,
        languages: hreflangLanguages(path),
      },
    }
  } catch {
    return {}
  }
}

export default async function ExpertProfilePage({ params }: Props) {
  const { locale, username } = await params
  setRequestLocale(locale)

  if (isReserved(username)) {
    notFound()
  }

  const t = await getTranslations("profile")
  const api = createPublicApiClient()

  let expert
  try {
    expert = await api.public.getExpert(username)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound()
    }
    throw error
  }

  const firstMode = expert.eventTypes
    .flatMap((eventType) => eventType.modes)
    .at(0)
  const firstEvent = expert.eventTypes.find((eventType) =>
    eventType.modes.some((mode) => mode.id === firstMode?.id)
  )

  let upcoming: { startLocal: string; label: string }[] = []
  if (firstMode && firstEvent) {
    const from = new Date()
    const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000)
    try {
      const slots = await api.public.getSlots(
        expert.username,
        firstEvent.slug,
        {
          modeId: firstMode.id,
          from: from.toISOString(),
          to: to.toISOString(),
          tz: "Europe/Lisbon",
        }
      )
      upcoming = slots.slots.slice(0, 3).map((slot) => ({
        startLocal: slot.startLocal,
        label: pickLocalizedText(firstEvent.title, locale),
      }))
    } catch {
      upcoming = []
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        nav={[
          { href: "/", labelKey: "home" },
          { href: "/experts", labelKey: "experts" },
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <div className="flex gap-5">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-semibold">
            {expert.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={expert.avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              expert.displayName.slice(0, 1)
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {expert.displayName}
            </h1>
            {expert.headline ? (
              <p className="mt-2 text-muted-foreground">{expert.headline}</p>
            ) : null}
            <p className="mt-3 text-sm text-muted-foreground">
              {[
                expert.languages.join(", "),
                expert.serviceCountries.join(", "),
                expert.categorySlugs.join(", "),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {expert.bio ? (
          <p className="mt-8 text-base leading-relaxed">{expert.bio}</p>
        ) : null}

        <section className="mt-10">
          <h2 className="text-xl font-semibold">{t("upcoming")}</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("noSlots")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcoming.map((slot) => (
                <li
                  key={`${slot.label}-${slot.startLocal}`}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  {slot.label} ·{" "}
                  {slot.startLocal.replace("T", " ").slice(0, 16)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">{t("offers")}</h2>
          <ul className="mt-4 space-y-3">
            {expert.eventTypes.map((eventType) => {
              const prices = eventType.modes.map((mode) => mode.priceCents)
              const minPrice =
                prices.length > 0 ? Math.min(...prices) : eventType.priceAmount
              return (
                <li
                  key={eventType.slug}
                  id={eventType.slug}
                  className="rounded-xl border p-4"
                >
                  <p className="font-medium">
                    {pickLocalizedText(eventType.title, locale)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("offerMeta", {
                      duration: String(eventType.durationMinutes),
                      price: formatEur(minPrice, locale),
                      modes: eventType.modes
                        .map((mode) => t(`modes.${mode.mode}`))
                        .join(", "),
                    })}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      </main>
    </div>
  )
}
