"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { intlLocale } from "@eleva/config/i18n"
import { pickLocalized } from "@eleva/config/i18n-locales"
import { CaretLeftIcon, CaretRightIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { cn } from "@eleva/ui/lib/utils"
import { useJoinCtaClock } from "@eleva/video/join-cta"
import { listCalendarBookingsAction } from "./actions"
import { BookingSheet } from "./booking-sheet"
import {
  addDays,
  agendaDays,
  isSameDay,
  layoutDay,
  nowLinePct,
  startOfWeek,
  visibleHours,
  type DayBlock,
} from "./calendar-layout"

export type CalendarBooking = {
  id: string
  status: string
  startsAt: string
  endsAt: string
  timezone: string
  sessionMode: "online" | "in_person" | "phone"
  memberFirstName: string | null
  approvalDeadlineAt: string | null
  eventTypeTitle: { en: string; pt?: string; es?: string }
  eventTypeSlug: string
  modeLabel: { en: string; pt?: string; es?: string } | null
  locationName: string | null
  locationCity: string | null
  locationCountry: string | null
  locationAddress: string | null
}

type Props = {
  initialFrom: string
  initialTo: string
  initialBookings: CalendarBooking[]
  orgSlug: string
}

const MODE_CLASS: Record<CalendarBooking["sessionMode"], string> = {
  online: "bg-primary text-primary-foreground",
  phone: "bg-info text-status-foreground",
  in_person: "bg-coral-700 text-white dark:bg-coral-400 dark:text-coral-950",
}
/** A request the expert has not answered yet: outlined, not filled. */
const PENDING_CLASS =
  "border border-dashed border-foreground/60 bg-card text-foreground"
const LEGEND_MODES: CalendarBooking["sessionMode"][] = [
  "online",
  "phone",
  "in_person",
]
/** Below this drawn length a block shows one line: time and title. */
const COMPACT_BELOW_MINUTES = 45
const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-none"

export function WeekView({
  initialFrom,
  initialTo,
  initialBookings,
  orgSlug,
}: Props) {
  const t = useTranslations("calendar")
  const locale = useLocale()
  // Times are shown in the device's time zone, which the server does not
  // know: the week is drawn once the page runs in the browser.
  const now = useJoinCtaClock(60_000)
  const ready = now !== null
  const [weekStart, setWeekStart] = React.useState(() =>
    startOfWeek(new Date())
  )
  const [fetched, setFetched] = React.useState<{
    key: string
    bookings: CalendarBooking[]
  } | null>(null)
  const [failedKey, setFailedKey] = React.useState<string | null>(null)
  const [attempt, setAttempt] = React.useState(0)
  /** Requests answered on this page, until the next load. */
  const [settled, setSettled] = React.useState<
    Record<string, "confirmed" | "cancelled">
  >({})
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )
  const rangeFromIso = weekStart.toISOString()
  const rangeToIso = addDays(weekStart, 7).toISOString()
  const rangeKey = `${rangeFromIso}|${rangeToIso}`
  const isInitial = rangeFromIso === initialFrom && rangeToIso === initialTo

  React.useEffect(() => {
    if (isInitial) return
    let cancelled = false
    const key = `${rangeFromIso}|${rangeToIso}`
    void listCalendarBookingsAction(rangeFromIso, rangeToIso)
      .then((result) => {
        if (cancelled) return
        if (!result.ok) {
          setFailedKey(key)
          return
        }
        setFailedKey(null)
        setFetched({
          key,
          bookings: result.data.bookings.map((booking) => ({
            ...booking,
            approvalDeadlineAt: booking.approvalDeadlineAt ?? null,
          })),
        })
      })
      .catch(() => {
        if (!cancelled) setFailedKey(key)
      })
    return () => {
      cancelled = true
    }
  }, [isInitial, rangeFromIso, rangeToIso, attempt])

  const failed = !isInitial && failedKey === rangeKey
  const loading = ready && !isInitial && !failed && fetched?.key !== rangeKey
  const bookings = React.useMemo(() => {
    const source = isInitial
      ? initialBookings
      : fetched?.key === rangeKey
        ? fetched.bookings
        : []
    return source
      .filter((b) => settled[b.id] !== "cancelled")
      .map((b) =>
        settled[b.id] === "confirmed" ? { ...b, status: "confirmed" } : b
      )
  }, [isInitial, initialBookings, fetched, rangeKey, settled])

  const selected = bookings.find((b) => b.id === selectedId) ?? null
  const formatters = React.useMemo(() => {
    const intl = intlLocale(locale)
    return {
      weekday: new Intl.DateTimeFormat(intl, { weekday: "short" }),
      fullDay: new Intl.DateTimeFormat(intl, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      range: new Intl.DateTimeFormat(intl, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      time: new Intl.DateTimeFormat(intl, { timeStyle: "short" }),
    }
  }, [locale])

  function modeName(mode: CalendarBooking["sessionMode"]): string {
    switch (mode) {
      case "online":
        return t("locationOnline")
      case "phone":
        return t("locationPhone")
      case "in_person":
        return t("modeInPerson")
      default: {
        const _exhaustive: never = mode
        return _exhaustive
      }
    }
  }
  const isRequest = (b: CalendarBooking) => b.status === "awaiting_confirmation"
  const who = (b: CalendarBooking) => b.memberFirstName ?? t("memberUnknown")
  // Two plain times: a range across midnight would spell out both dates.
  const timeRange = (b: CalendarBooking) =>
    `${formatters.time.format(new Date(b.startsAt))}–${formatters.time.format(new Date(b.endsAt))}`
  /** Everything a block says, for someone who cannot see it. */
  const summary = (b: CalendarBooking) =>
    [
      timeRange(b),
      pickLocalized(b.eventTypeTitle, locale),
      who(b),
      modeName(b.sessionMode),
      isRequest(b) ? t("requestPending") : null,
    ]
      .filter(Boolean)
      .join(", ")
  const open = (id: string) => {
    setSelectedId(id)
    setSheetOpen(true)
  }

  const hours = visibleHours(bookings, days)
  const hourList = Array.from(
    { length: hours.end - hours.start },
    (_, i) => hours.start + i
  )
  const agenda = agendaDays(bookings, days)
  const timeZone = ready
    ? Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ")
    : null

  return (
    <div className="@container space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="font-display text-xl font-medium tracking-tight"
          aria-live="polite"
        >
          {ready
            ? formatters.range.formatRange(weekStart, addDays(weekStart, 6))
            : " "}
          {loading ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {t("loading")}
            </span>
          ) : null}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("prevWeek")}
            onPress={() => setWeekStart((w) => addDays(w, -7))}
          >
            <CaretLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={() => setWeekStart(startOfWeek(new Date()))}
          >
            {t("thisWeek")}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("nextWeek")}
            onPress={() => setWeekStart((w) => addDays(w, 7))}
          >
            <CaretRightIcon />
          </Button>
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {LEGEND_MODES.map((mode) => (
            <li key={mode} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("size-2.5 rounded-full", MODE_CLASS[mode])}
              />
              {modeName(mode)}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full border border-dashed border-foreground/60"
            />
            {t("requestPending")}
          </li>
        </ul>
        {timeZone ? <p>{t("timezone", { zone: timeZone })}</p> : null}
      </div>

      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p>{t("error.load-failed")}</p>
          <Button
            variant="outline"
            size="sm"
            onPress={() => {
              setFailedKey(null)
              setAttempt((n) => n + 1)
            }}
          >
            {t("retry")}
          </Button>
        </div>
      ) : null}

      {now === null ? (
        <div
          aria-hidden
          className="h-96 rounded-3xl border bg-card shadow-1 motion-safe:animate-pulse"
        />
      ) : (
        <>
          {/* Wide: the week as a grid. */}
          <div className="hidden overflow-x-auto rounded-3xl border bg-card shadow-1 @xl:block">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `3.5rem repeat(7, minmax(0, 1fr))`,
                gridTemplateRows: `auto repeat(${hourList.length}, 4rem)`,
              }}
            >
              <div className="border-b" style={{ gridColumn: 1, gridRow: 1 }} />
              {days.map((day, col) => {
                const isToday = isSameDay(day, now)
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-b border-l px-2 py-3 text-center",
                      isToday && "bg-teal-50/70 dark:bg-teal-950/30"
                    )}
                    style={{ gridColumn: col + 2, gridRow: 1 }}
                  >
                    <span className="block eyebrow text-[10px]">
                      {formatters.weekday.format(day).replaceAll(".", "")}
                    </span>
                    <span
                      className={cn(
                        "mx-auto mt-1 flex size-8 items-center justify-center rounded-full font-display text-lg tabular-nums",
                        isToday && "bg-primary text-primary-foreground"
                      )}
                      aria-current={isToday ? "date" : undefined}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                )
              })}

              {hourList.map((hour, row) => (
                <React.Fragment key={hour}>
                  <div
                    aria-hidden
                    className="border-b px-2 py-1.5 text-right text-[10px] text-muted-foreground tabular-nums"
                    style={{ gridColumn: 1, gridRow: row + 2 }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {days.map((day, col) => (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      aria-hidden
                      className={cn(
                        "border-b border-l",
                        isSameDay(day, now) &&
                          "bg-teal-50/40 dark:bg-teal-950/20"
                      )}
                      style={{ gridColumn: col + 2, gridRow: row + 2 }}
                    />
                  ))}
                </React.Fragment>
              ))}

              {days.map((day, col) => {
                const blocks = layoutDay(bookings, day, hours)
                const nowPct = isSameDay(day, now)
                  ? nowLinePct(now, hours)
                  : null
                return (
                  <div
                    key={`sessions-${day.toISOString()}`}
                    className="relative"
                    style={{
                      gridColumn: col + 2,
                      gridRow: `2 / span ${hourList.length}`,
                    }}
                  >
                    {blocks.length > 0 ? (
                      <ul
                        aria-label={formatters.fullDay.format(day)}
                        className="absolute inset-0"
                      >
                        {blocks.map((block) => (
                          <li
                            key={block.item.id}
                            className="absolute p-0.5"
                            style={{
                              top: `${block.topPct}%`,
                              height: `${block.heightPct}%`,
                              left: `${(block.lane / block.lanes) * 100}%`,
                              width: `${100 / block.lanes}%`,
                            }}
                          >
                            <SessionBlock
                              block={block}
                              label={summary(block.item)}
                              time={formatters.time.format(
                                new Date(block.item.startsAt)
                              )}
                              timeRange={timeRange(block.item)}
                              title={pickLocalized(
                                block.item.eventTypeTitle,
                                locale
                              )}
                              detail={
                                isRequest(block.item)
                                  ? t("requestPending")
                                  : block.item.memberFirstName
                              }
                              onOpen={() => open(block.item.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {nowPct !== null ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                        style={{ top: `${nowPct}%` }}
                      >
                        <span className="-ml-1 size-2 rounded-full bg-coral-600" />
                        <span className="h-px flex-1 bg-coral-600" />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Narrow: the same week as a list, day by day. */}
          <div className="space-y-5 @xl:hidden" data-testid="calendar-agenda">
            {agenda.map(({ day, items }) => (
              <section key={day.toISOString()}>
                <h3 className="flex items-baseline gap-2 px-1 text-sm font-medium">
                  <span className="first-letter:uppercase">
                    {formatters.fullDay.format(day)}
                  </span>
                  {isSameDay(day, now) ? (
                    <span className="eyebrow text-[10px] text-primary">
                      {t("today")}
                    </span>
                  ) : null}
                </h3>
                <ul className="mt-2 divide-y overflow-hidden rounded-2xl border bg-card shadow-1">
                  {items.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        data-testid="calendar-session"
                        className={cn(
                          "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                          FOCUS_RING,
                          "focus-visible:ring-inset"
                        )}
                        onClick={() => open(b.id)}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "h-10 w-1.5 shrink-0 rounded-full",
                            isRequest(b)
                              ? "border border-dashed border-foreground/60"
                              : MODE_CLASS[b.sessionMode]
                          )}
                        />
                        <span className="w-12 shrink-0 text-sm tabular-nums">
                          <span className="block font-medium">
                            {formatters.time.format(new Date(b.startsAt))}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatters.time.format(new Date(b.endsAt))}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {pickLocalized(b.eventTypeTitle, locale)}
                          </span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {who(b)} · {modeName(b.sessionMode)}
                          </span>
                        </span>
                        {isRequest(b) ? (
                          <StatusPill tone="attention">
                            {t("requestPending")}
                          </StatusPill>
                        ) : null}
                        <CaretRightIcon
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {bookings.length === 0 && !loading && !failed ? (
            <p className="rounded-3xl border border-dashed border-sand-300 bg-sand-50/70 p-6 text-center text-sm text-muted-foreground dark:border-border dark:bg-card">
              {t("emptyWeek")}
            </p>
          ) : null}
        </>
      )}

      <BookingSheet
        booking={selected}
        isOpen={sheetOpen && selected !== null}
        onOpenChange={setSheetOpen}
        orgSlug={orgSlug}
        modeName={modeName}
        onSettled={(bookingId, status) => {
          setSettled((curr) => ({ ...curr, [bookingId]: status }))
          if (status === "cancelled") setSheetOpen(false)
        }}
      />
    </div>
  )
}

function SessionBlock({
  block,
  label,
  time,
  timeRange,
  title,
  detail,
  onOpen,
}: {
  block: DayBlock<CalendarBooking>
  label: string
  time: string
  timeRange: string
  title: string
  detail: string | null
  onOpen: () => void
}) {
  const { item } = block
  const compact = block.drawnMinutes < COMPACT_BELOW_MINUTES
  return (
    <button
      type="button"
      data-testid="calendar-session"
      aria-label={label}
      title={label}
      className={cn(
        "block size-full overflow-hidden rounded-lg px-1.5 text-left text-[11px] shadow-1 transition-opacity hover:opacity-90",
        FOCUS_RING,
        compact ? "py-px leading-[1.2]" : "py-1 leading-tight",
        item.status === "awaiting_confirmation"
          ? PENDING_CLASS
          : MODE_CLASS[item.sessionMode],
        block.continuesFromBefore && "rounded-t-none",
        block.continuesAfter && "rounded-b-none"
      )}
      onClick={onOpen}
    >
      {compact ? (
        <span className="block truncate">
          <span className="tabular-nums opacity-90">{time}</span>{" "}
          <span className="font-medium">{title}</span>
        </span>
      ) : (
        <>
          <span className="block truncate tabular-nums opacity-90">
            {block.lanes > 1 ? time : timeRange}
          </span>
          <span className="block truncate font-medium">{title}</span>
          {detail && block.drawnMinutes >= 60 ? (
            <span className="block truncate opacity-90">{detail}</span>
          ) : null}
        </>
      )}
    </button>
  )
}
