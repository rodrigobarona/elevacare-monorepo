"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { intlLocale } from "@eleva/config/i18n"
import { pickLocalized } from "@eleva/config/i18n-locales"
import {
  CaretLeftIcon,
  CaretRightIcon,
  MapPinIcon,
  PhoneIcon,
  VideoCameraIcon,
} from "@eleva/icons"
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
import {
  sessionKind,
  shouldRefreshOnReturn,
  weekData,
  weekRangeKey,
  type LoadedWeek,
  type SessionKind,
  type Settled,
} from "./week-data"

export type CalendarBooking = {
  id: string
  status: string
  startsAt: string
  endsAt: string
  sessionMode: "online" | "in_person" | "phone"
  memberFirstName: string | null
  approvalDeadlineAt: string | null
  eventTypeTitle: { en: string; pt?: string; es?: string }
  modeLabel: { en: string; pt?: string; es?: string } | null
  locationName: string | null
  locationCity: string | null
  locationCountry: string | null
}

type SessionMode = CalendarBooking["sessionMode"]

const MODE_CLASS: Record<SessionMode, string> = {
  online: "bg-primary text-primary-foreground",
  phone: "bg-info text-status-foreground",
  in_person: "bg-coral-700 text-white dark:bg-coral-400 dark:text-coral-950",
}
/** The mode is never told by colour alone: each has its own icon. */
const MODE_ICON: Record<SessionMode, typeof VideoCameraIcon> = {
  online: VideoCameraIcon,
  phone: PhoneIcon,
  in_person: MapPinIcon,
}
/**
 * Not a confirmed session yet (a request to answer, or a booking still
 * being paid): outlined and tinted, never filled like a session.
 */
const UNCONFIRMED_CLASS =
  "border border-dashed border-foreground bg-coral-50 text-foreground dark:bg-coral-950"
/** Already over: a tint of its mode with dark text, so it steps back but stays readable. */
const OVER_CLASS: Record<SessionMode, string> = {
  online: "bg-primary/15 text-foreground",
  phone: "bg-info/15 text-foreground",
  in_person: "bg-coral-700/15 text-foreground dark:bg-coral-400/20",
}
const LEGEND_MODES: SessionMode[] = ["online", "phone", "in_person"]
/**
 * Below this drawn length a block shows one line: time and name. More than
 * three side by side are bars with no text (their label still names them).
 */
const COMPACT_BELOW_MINUTES = 45
const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-none"
/** The sheet's closing transition, after which focus can be moved. */
const SHEET_CLOSE_MS = 250

export function WeekView({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations("calendar")
  const locale = useLocale()
  // Times are shown in the device's time zone, which the server does not
  // know: the week is loaded and drawn in the browser.
  const now = useJoinCtaClock(60_000)
  const [weekStart, setWeekStart] = React.useState(() =>
    startOfWeek(new Date())
  )
  const [loaded, setLoaded] =
    React.useState<LoadedWeek<CalendarBooking> | null>(null)
  const [failedKey, setFailedKey] = React.useState<string | null>(null)
  const [attempt, setAttempt] = React.useState(0)
  const [settled, setSettled] = React.useState<Settled>({})
  const lastLoadedAt = React.useRef<number | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const upcomingRef = React.useRef<HTMLElement>(null)
  const scrolledFor = React.useRef<string | null>(null)

  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )
  const rangeFromIso = weekStart.toISOString()
  const rangeToIso = addDays(weekStart, 7).toISOString()
  const rangeKey = weekRangeKey(rangeFromIso, rangeToIso)

  React.useEffect(() => {
    let cancelled = false
    const key = weekRangeKey(rangeFromIso, rangeToIso)
    void listCalendarBookingsAction(rangeFromIso, rangeToIso)
      .then((result) => {
        if (cancelled) return
        if (!result.ok) {
          setFailedKey(key)
          return
        }
        lastLoadedAt.current = Date.now()
        setFailedKey(null)
        setSettled({})
        setLoaded({ key, bookings: result.data.bookings })
      })
      .catch(() => {
        if (!cancelled) setFailedKey(key)
      })
    return () => {
      cancelled = true
    }
  }, [rangeFromIso, rangeToIso, attempt])

  // A calendar left open (a phone between sessions) loads the week again
  // when the expert comes back to it, so a new request is not missed.
  React.useEffect(() => {
    const refresh = () => {
      if (
        shouldRefreshOnReturn({
          visible: document.visibilityState === "visible",
          lastLoadedAt: lastLoadedAt.current,
          now: Date.now(),
        })
      ) {
        lastLoadedAt.current = Date.now()
        setAttempt((n) => n + 1)
      }
    }
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [])

  const { failed, loading, bookings } = React.useMemo(
    () => weekData({ rangeKey, loaded, failedKey, settled }),
    [rangeKey, loaded, failedKey, settled]
  )

  const selected = bookings.find((b) => b.id === selectedId) ?? null
  const formatters = React.useMemo(() => {
    const intl = intlLocale(locale)
    return {
      weekday: new Intl.DateTimeFormat(intl, { weekday: "short" }),
      month: new Intl.DateTimeFormat(intl, { month: "short" }),
      fullDay: new Intl.DateTimeFormat(intl, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      time: new Intl.DateTimeFormat(intl, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      zone: new Intl.DateTimeFormat(intl, { timeZoneName: "longGeneric" }),
    }
  }, [locale])

  function modeName(mode: SessionMode): string {
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
  /** What to call a booking that is not a confirmed session yet. */
  const kindLabel = (kind: SessionKind): string | null =>
    kind === "request"
      ? t("requestPending")
      : kind === "unpaid"
        ? t("awaitingPayment")
        : null
  const who = (b: CalendarBooking) => b.memberFirstName ?? t("memberUnknown")
  // Two plain times: a range across midnight would spell out both dates.
  const timeRange = (b: CalendarBooking) =>
    `${formatters.time.format(new Date(b.startsAt))}–${formatters.time.format(new Date(b.endsAt))}`
  /** Everything a block says, for someone who cannot see it. */
  const summary = (b: CalendarBooking) =>
    [
      timeRange(b),
      who(b),
      pickLocalized(b.eventTypeTitle, locale),
      modeName(b.sessionMode),
      kindLabel(sessionKind(b.status)),
    ]
      .filter(Boolean)
      .join(", ")
  /** "26 Oct – 1 Nov 2026", built by hand so every language keeps month names. */
  const weekLabel = () => {
    const part = (date: Date) =>
      `${date.getDate()} ${formatters.month.format(date).replaceAll(".", "")}`
    const last = addDays(weekStart, 6)
    return `${part(weekStart)} – ${part(last)} ${last.getFullYear()}`
  }
  const open = (id: string) => {
    setSelectedId(id)
    setSheetOpen(true)
  }
  const goTo = (week: Date) => {
    setFailedKey(null)
    // The same week again ("This week" while on it) loads it afresh.
    if (week.getTime() === weekStart.getTime()) setAttempt((n) => n + 1)
    setWeekStart(week)
  }

  const hours = visibleHours(bookings, days)
  const hourList = Array.from(
    { length: hours.end - hours.start },
    (_, i) => hours.start + i
  )
  const agenda = agendaDays(bookings, days)
  // On a phone the list starts at Monday: bring the next day with sessions
  // into view once, so the expert does not scroll past days already gone.
  const upcomingDay = now
    ? agenda.find(({ day }) => isSameDay(day, now) || day > now)?.day
    : undefined
  React.useEffect(() => {
    if (loading || failed || scrolledFor.current === rangeKey) return
    scrolledFor.current = rangeKey
    const section = upcomingRef.current
    // Only as a list (the grid shows the whole week), and only when there
    // are earlier days above it.
    if (!section || section.offsetParent === null) return
    if (!section.previousElementSibling) return
    section.scrollIntoView({ block: "start" })
  }, [loading, failed, rangeKey])

  const timeZone = now
    ? (formatters.zone
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value ??
      Intl.DateTimeFormat().resolvedOptions().timeZone)
    : null

  return (
    <div className="@container space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-xl font-medium tracking-tight outline-none"
          aria-live="polite"
        >
          {now ? weekLabel() : " "}
          {now && loading ? (
            <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">
              {t("loading")}
            </span>
          ) : null}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("prevWeek")}
            onPress={() => goTo(addDays(weekStart, -7))}
          >
            <CaretLeftIcon />
          </Button>
          <Button
            variant="outline"
            onPress={() => goTo(startOfWeek(new Date()))}
          >
            {t("thisWeek")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("nextWeek")}
            onPress={() => goTo(addDays(weekStart, 7))}
          >
            <CaretRightIcon />
          </Button>
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {LEGEND_MODES.map((mode) => {
            const Icon = MODE_ICON[mode]
            return (
              <li key={mode} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full",
                    MODE_CLASS[mode]
                  )}
                >
                  <Icon className="size-2.5" />
                </span>
                {modeName(mode)}
              </li>
            )
          })}
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-4 rounded-full border border-dashed border-foreground bg-coral-50 dark:bg-coral-950"
            />
            {t("notConfirmed")}
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

      {now === null || loading ? (
        // A week still loading never looks like a free week.
        <div
          aria-hidden
          data-testid="calendar-loading"
          className="h-96 rounded-3xl border bg-card shadow-1 motion-safe:animate-pulse @xl:h-[62rem]"
        />
      ) : failed ? null : (
        <>
          {bookings.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-sand-300 bg-sand-50/70 p-6 text-center text-sm text-muted-foreground dark:border-border dark:bg-card">
              {t("emptyWeek")}
            </p>
          ) : null}

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
                            className="absolute px-0.5 py-px"
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
                              who={who(block.item)}
                              title={pickLocalized(
                                block.item.eventTypeTitle,
                                locale
                              )}
                              kindLabel={kindLabel(
                                sessionKind(block.item.status)
                              )}
                              over={new Date(block.item.endsAt) < now}
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
                        <span className="-ml-1 size-2 rounded-full bg-foreground" />
                        <span className="h-px flex-1 bg-foreground" />
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
              <section
                key={day.toISOString()}
                ref={day === upcomingDay ? upcomingRef : undefined}
                className="scroll-mt-20"
              >
                <h3 className="flex items-baseline gap-2 px-1 font-medium">
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
                  {items.map((b) => {
                    const over = new Date(b.endsAt) < now
                    const kind = sessionKind(b.status)
                    const ModeIcon = MODE_ICON[b.sessionMode]
                    return (
                      <li key={b.id}>
                        <button
                          type="button"
                          data-testid="calendar-session"
                          aria-label={summary(b)}
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
                              "flex size-8 shrink-0 items-center justify-center rounded-full",
                              kind !== "session"
                                ? UNCONFIRMED_CLASS
                                : over
                                  ? OVER_CLASS[b.sessionMode]
                                  : MODE_CLASS[b.sessionMode]
                            )}
                          >
                            <ModeIcon className="size-4" />
                          </span>
                          <span className="w-12 shrink-0 text-sm tabular-nums">
                            <span
                              className={cn(
                                "block font-medium",
                                over && "font-normal text-muted-foreground"
                              )}
                            >
                              {formatters.time.format(new Date(b.startsAt))}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatters.time.format(new Date(b.endsAt))}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate font-medium",
                                over && "font-normal text-muted-foreground"
                              )}
                            >
                              {who(b)}
                            </span>
                            <span className="block truncate text-sm text-muted-foreground">
                              {pickLocalized(b.eventTypeTitle, locale)} ·{" "}
                              {modeName(b.sessionMode)}
                            </span>
                            {kind !== "session" ? (
                              <StatusPill tone="attention" className="mt-1.5">
                                {kindLabel(kind)}
                              </StatusPill>
                            ) : null}
                          </span>
                          <CaretRightIcon
                            aria-hidden
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <BookingSheet
        booking={selected}
        isOpen={sheetOpen && selected !== null}
        onOpenChange={setSheetOpen}
        orgSlug={orgSlug}
        modeName={modeName}
        onSettled={(bookingId, status) => {
          // Answered: back to the week. A declined request leaves the
          // calendar, so focus goes to the week heading instead of nowhere.
          setSheetOpen(false)
          setSettled((curr) => ({ ...curr, [bookingId]: status }))
          if (status === "cancelled") {
            window.setTimeout(() => headingRef.current?.focus(), SHEET_CLOSE_MS)
          }
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
  who,
  title,
  kindLabel,
  over,
  onOpen,
}: {
  block: DayBlock<CalendarBooking>
  label: string
  time: string
  timeRange: string
  who: string
  title: string
  /** "Booking request" or "Awaiting payment"; `null` for a session. */
  kindLabel: string | null
  over: boolean
  onOpen: () => void
}) {
  const { item } = block
  const compact = block.drawnMinutes < COMPACT_BELOW_MINUTES
  const bar = block.lanes > 3
  /** Room for a third line. */
  const tall = block.drawnMinutes >= 60
  const Icon = MODE_ICON[item.sessionMode]
  return (
    <button
      type="button"
      data-testid="calendar-session"
      aria-label={label}
      title={label}
      className={cn(
        "block size-full min-w-0 overflow-hidden rounded-lg text-left text-[11px] shadow-1 transition-opacity hover:opacity-90",
        FOCUS_RING,
        bar ? "px-0" : "px-1.5",
        compact ? "py-0.5 leading-[1.3]" : "py-1 leading-tight",
        kindLabel
          ? UNCONFIRMED_CLASS
          : over
            ? OVER_CLASS[item.sessionMode]
            : MODE_CLASS[item.sessionMode],
        block.continuesFromBefore && "rounded-t-none",
        block.continuesAfter && "rounded-b-none"
      )}
      onClick={onOpen}
    >
      {bar ? null : compact ? (
        <span className="flex items-center gap-1">
          <Icon aria-hidden className="size-3 shrink-0 opacity-90" />
          <span className="truncate">
            <span className="tabular-nums opacity-90">{time}</span>{" "}
            <span className="font-medium">{who}</span>
          </span>
        </span>
      ) : (
        <>
          <span className="block truncate tabular-nums opacity-90">
            {kindLabel && !tall ? (
              <>
                {time} <UnconfirmedLabel>{kindLabel}</UnconfirmedLabel>
              </>
            ) : block.lanes > 1 ? (
              time
            ) : (
              timeRange
            )}
          </span>
          <span className="flex items-center gap-1">
            <Icon aria-hidden className="size-3 shrink-0 opacity-90" />
            <span className="truncate font-medium">{who}</span>
          </span>
          {!tall ? null : kindLabel ? (
            <UnconfirmedLabel className="block truncate">
              {kindLabel}
            </UnconfirmedLabel>
          ) : (
            <span className="block truncate opacity-90">{title}</span>
          )}
        </>
      )}
    </button>
  )
}

function UnconfirmedLabel({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "font-medium text-coral-800 dark:text-coral-200",
        className
      )}
    >
      {children}
    </span>
  )
}
