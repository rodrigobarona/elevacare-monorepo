"use client"

import { useId, useState } from "react"
import {
  ArrowRightIcon,
  MapPinIcon,
  PhoneIcon,
  VideoCameraIcon,
} from "@eleva/icons"
import { ChoiceRows } from "@eleva/ui/components/booking/choice-rows"
import { cn } from "@eleva/ui/lib/utils"
import { Link } from "@/i18n/navigation"
import type { SessionMode } from "@/lib/upcoming-slots"

const MODE_ICONS = {
  online: VideoCameraIcon,
  in_person: MapPinIcon,
  phone: PhoneIcon,
} satisfies Record<SessionMode, unknown>

export type BookingCardSlot = {
  href: string
  time: string
  /** "Book First visit on Monday 9 November at 09:00, video call". */
  ariaLabel: string
  mode: SessionMode
  /** Place name, set only when the service is offered in several places. */
  place: string | null
  start: string
}

export type BookingCardService = {
  slug: string
  title: string
  /** "60 min · €60 total". */
  meta: string
  policy: string | null
  seeAllHref: string
  /** Slots grouped by local day, soonest first. */
  days: { key: string; label: string; slots: BookingCardSlot[] }[]
  /** Several ways to meet: each time shows its mode icon. */
  showModes: boolean
  /**
   * Some times could not be loaded. With no times shown, the card says so
   * instead of saying the calendar is full.
   */
  loadFailed: boolean
}

/**
 * The profile's booking card. Every service's times are rendered on the
 * server; picking a service only swaps which list is shown.
 */
export function BookingCard({
  services,
  labels,
}: {
  services: BookingCardService[]
  labels: {
    heading: string
    chooseService: string
    timesIn: string
    full: string
    loadFailed: string
    laterDates: string
    seeAll: string
    noAccount: string
  }
}) {
  const [selected, setSelected] = useState(services[0]?.slug ?? "")
  const headingId = useId()
  const serviceLabelId = useId()
  const service = services.find((item) => item.slug === selected) ?? services[0]
  if (!service) return null
  const hasSlots = service.days.length > 0

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-5 rounded-4xl border bg-card p-6 shadow-2"
    >
      <h2
        id={headingId}
        tabIndex={-1}
        className="font-display text-2xl font-medium tracking-tight outline-none"
      >
        {labels.heading}
      </h2>

      {services.length > 1 ? (
        <div className="flex flex-col gap-2">
          <p id={serviceLabelId} className="text-sm text-muted-foreground">
            {labels.chooseService}
          </p>
          <ChoiceRows
            labelledBy={serviceLabelId}
            selectedKey={service.slug}
            onSelectionChange={setSelected}
            items={services.map((item) => ({
              id: item.slug,
              title: item.title,
              meta: item.meta,
            }))}
          />
        </div>
      ) : (
        <div className="flex flex-col">
          <p className="font-medium">{service.title}</p>
          <p className="text-sm text-muted-foreground">{service.meta}</p>
        </div>
      )}

      {hasSlots ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{labels.timesIn}</p>
          {service.days.map((day) => (
            <div key={day.key} className="flex flex-col gap-2">
              <p className="text-sm font-medium">{day.label}</p>
              <ul className="grid grid-cols-3 gap-2">
                {day.slots.map((slot) => {
                  const Icon = MODE_ICONS[slot.mode]
                  return (
                    <li key={slot.href}>
                      <Link
                        href={slot.href}
                        data-testid="profile-upcoming-slot"
                        data-event-slug={service.slug}
                        aria-label={slot.ariaLabel}
                        className={cn(
                          "flex min-h-11 flex-col items-center justify-center border border-input-border bg-background px-2 text-sm font-medium tabular-nums transition-colors hover:border-primary hover:bg-teal-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:bg-teal-950",
                          slot.place ? "rounded-2xl py-1" : "rounded-full"
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          {service.showModes ? (
                            <Icon aria-hidden className="size-3.5 shrink-0" />
                          ) : null}
                          {slot.time}
                        </span>
                        {slot.place ? (
                          <span
                            aria-hidden
                            className="max-w-full truncate text-xs font-normal text-muted-foreground"
                          >
                            {slot.place}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
          {service.loadFailed ? labels.loadFailed : labels.full}
        </p>
      )}

      <Link
        href={service.seeAllHref}
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-primary underline underline-offset-4"
      >
        {hasSlots || service.loadFailed ? labels.seeAll : labels.laterDates}
        <ArrowRightIcon aria-hidden className="size-4" />
      </Link>

      <ul className="flex flex-col gap-1 border-t pt-4 text-sm text-muted-foreground">
        <li className="font-medium text-foreground">{service.meta}</li>
        <li>{labels.noAccount}</li>
        {service.policy ? <li>{service.policy}</li> : null}
      </ul>
    </section>
  )
}
