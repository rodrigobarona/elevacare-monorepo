"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Dialog,
  DialogTrigger,
  Heading,
  I18nProvider,
  Popover,
  ToggleButton,
} from "react-aria-components"
import { today } from "@internationalized/date"
import { Button } from "@eleva/ui/components/button"
import {
  addDaysToKey,
  dateKeyInZone,
  groupSlotsByDay,
  type FunnelSlot,
} from "@eleva/ui/lib/booking/slot-groups"
import { cn } from "@eleva/ui/lib/utils"
import { ArrowLeftIcon, ArrowRightIcon, CalendarDotsIcon } from "@eleva/icons"

/** Times shown per day before "+N more". */
const TIMES_PER_DAY = 4

const MORE_BUTTON =
  "min-h-11 rounded-full text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * Pick a time as a strip of open days (Doctolib, intro.co): each day is a
 * column with its times, so a time is one tap. Only days with open times
 * appear. The strip scrolls sideways; "Later dates" loads the next weeks and
 * "Choose a date" jumps anywhere with a calendar. The continue action sits
 * under the strip, and is a sticky bar on phones.
 */
export function SlotPicker({
  slots,
  timeZone,
  locale,
  fromKey,
  isLoading = false,
  selectedStart,
  onSelect,
  onLaterDates,
  onJumpTo,
  earliest,
  onSelectEarliest,
  continueAction,
  labels,
  className,
}: {
  slots: readonly FunnelSlot[]
  timeZone: string
  /** `Intl` locale, e.g. "en-IE". */
  locale: string
  /** First civil day of the loaded window, e.g. "2026-11-09". */
  fromKey: string
  /** Times for this window are still loading: say nothing about gaps yet. */
  isLoading?: boolean
  selectedStart: string | null
  onSelect: (slot: FunnelSlot) => void
  /** Load the weeks after the loaded window. */
  onLaterDates: () => void
  /** Load times from a chosen day onwards. */
  onJumpTo: (dateKey: string) => void
  /** Earliest open time for this booking, from any window. */
  earliest: FunnelSlot | null
  onSelectEarliest: (slot: FunnelSlot) => void
  /** Receives the selection as "Tue 10 Nov, 10:00". */
  continueAction: (when: string) => ReactNode
  labels: {
    strip: string
    /** Scroll the strip back / on, e.g. "Earlier days". */
    earlierDays: string
    laterDays: string
    /** Calendar months. */
    previous: string
    next: string
    today: string
    tomorrow: string
    /** "+3 more". */
    more: (count: number) => string
    less: string
    laterDates: string
    chooseDate: string
    calendar: string
    empty: string
    /** "Next available: Mon 9 Nov, 14:30". */
    nextAvailable: (when: string) => string
    /** "Book Tuesday 10 November, 10:00". */
    timeAccessible: (when: string) => string
    /** "Tuesday 10 November, 10:00 selected". */
    selected: (when: string) => string
  }
  className?: string
}) {
  const stripRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const stripId = useId()
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [focusStart, setFocusStart] = useState<string | null>(null)

  const todayKey = dateKeyInZone(new Date().toISOString(), timeZone)
  const days = groupSlotsByDay(slots, timeZone).filter(
    (day) => day.dateKey >= fromKey
  )
  const selectedDay = selectedStart
    ? dateKeyInZone(selectedStart, timeZone)
    : null

  // Day keys are civil dates: format them at noon UTC so no zone shifts them.
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  })
  const dayMonth = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
  const longDayOfKey = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
  const longDay = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  })
  const shortDay = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  })
  // 24 h like the profile and every email, so a time reads the same
  // everywhere the member sees it.
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  })
  const describe = (iso: string, format: Intl.DateTimeFormat) =>
    `${format.format(new Date(iso))}, ${timeFormat.format(new Date(iso))}`

  // Focus moves only when the member asked for "Next available".
  useEffect(() => {
    if (!focusStart) return
    const target = rootRef.current?.querySelector<HTMLElement>(
      `[data-start="${CSS.escape(focusStart)}"]`
    )
    if (!target) return
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: "center", inline: "center" })
    setFocusStart(null)
  })

  // While the phone action bar shows, keep focused content clear of it
  // (WCAG 2.4.11).
  useEffect(() => {
    if (!selectedStart) return
    const root = document.documentElement
    const phone = window.matchMedia("(max-width: 639px)")
    const update = () => {
      root.style.scrollPaddingBottom = phone.matches ? "6rem" : ""
    }
    update()
    phone.addEventListener("change", update)
    return () => {
      phone.removeEventListener("change", update)
      root.style.scrollPaddingBottom = ""
    }
  }, [selectedStart])

  // A new window of days starts at its first day.
  const firstDay = days[0]?.dateKey ?? ""
  useEffect(() => {
    stripRef.current?.scrollTo({ left: 0 })
  }, [fromKey, firstDay])

  function scrollStrip(direction: 1 | -1) {
    const strip = stripRef.current
    if (!strip) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    strip.scrollBy({
      left: direction * strip.clientWidth * 0.9,
      behavior: reduce.matches ? "auto" : "smooth",
    })
  }

  function toggleDay(key: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const dayName = (key: string) =>
    key === todayKey
      ? labels.today
      : key === addDaysToKey(todayKey, 1)
        ? labels.tomorrow
        : weekday.format(new Date(`${key}T12:00:00Z`))

  // Shown only after jumping past the earliest open day.
  const earliestDay = earliest ? dateKeyInZone(earliest.start, timeZone) : null
  const showEarliest =
    earliest != null && earliestDay != null && earliestDay < fromKey

  return (
    <div
      ref={rootRef}
      data-slot="slot-picker"
      className={cn("flex flex-col gap-4", className)}
    >
      {showEarliest && earliest ? (
        <Button
          variant="outline"
          className="min-h-11 self-start rounded-full"
          data-testid="booking-next-available"
          onPress={() => {
            onSelectEarliest(earliest)
            setFocusStart(earliest.start)
          }}
        >
          <CalendarDotsIcon data-icon="inline-start" />
          {labels.nextAvailable(describe(earliest.start, shortDay))}
        </Button>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p id={stripId} className="text-sm font-medium">
          {labels.strip}
        </p>
        <div className="flex items-center gap-1">
          <DialogTrigger>
            <Button
              variant="ghost"
              className="min-h-11 rounded-full px-3 text-sm"
              data-testid="booking-choose-date"
            >
              <CalendarDotsIcon data-icon="inline-start" />
              {labels.chooseDate}
            </Button>
            <Popover
              placement="bottom end"
              className="rounded-3xl border bg-popover p-3 text-popover-foreground shadow-lg outline-none"
            >
              <Dialog aria-label={labels.calendar} className="outline-none">
                {({ close }) => (
                  <JumpCalendar
                    locale={locale}
                    timeZone={timeZone}
                    label={labels.calendar}
                    previous={labels.previous}
                    next={labels.next}
                    onPick={(key) => {
                      onJumpTo(key)
                      close()
                    }}
                  />
                )}
              </Dialog>
            </Popover>
          </DialogTrigger>
          <Button
            variant="ghost"
            size="icon"
            aria-label={labels.earlierDays}
            className="size-11 rounded-full max-sm:hidden"
            onPress={() => scrollStrip(-1)}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={labels.laterDays}
            className="size-11 rounded-full max-sm:hidden"
            onPress={() => scrollStrip(1)}
          >
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div
        ref={stripRef}
        role="group"
        aria-labelledby={stripId}
        // No scroll anchoring: days load in front of "Later dates" and the
        // strip must stay at its first day.
        className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2 [overflow-anchor:none]"
      >
        {days.length === 0 && !isLoading ? (
          <p className="w-56 shrink-0 py-3 text-sm text-muted-foreground">
            {labels.empty}
          </p>
        ) : null}
        {days.map((day) => {
          const holdsSelection = day.dateKey === selectedDay
          const selectedIndex = day.slots.findIndex(
            (slot) => slot.start === selectedStart
          )
          const isOpen =
            expanded.has(day.dateKey) || selectedIndex >= TIMES_PER_DAY
          const visible = isOpen ? day.slots : day.slots.slice(0, TIMES_PER_DAY)
          const hidden = day.slots.length - visible.length
          const canCollapse = isOpen && day.slots.length > TIMES_PER_DAY
          const headingId = `${stripId}-${day.dateKey}`
          const date = new Date(`${day.dateKey}T12:00:00Z`)
          return (
            <div
              key={day.dateKey}
              role="group"
              aria-labelledby={headingId}
              className="flex w-28 shrink-0 snap-start flex-col gap-2"
            >
              <button
                type="button"
                id={headingId}
                data-testid="booking-slot-day"
                aria-label={longDayOfKey.format(date)}
                aria-expanded={
                  day.slots.length > TIMES_PER_DAY ? isOpen : undefined
                }
                onClick={() => toggleDay(day.dateKey)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-2xl px-1 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  holdsSelection ? "text-primary" : "text-foreground"
                )}
              >
                <span className="text-sm font-semibold first-letter:uppercase">
                  {dayName(day.dateKey)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {dayMonth.format(date)}
                </span>
              </button>
              {visible.map((slot) => {
                const isSelected = selectedStart === slot.start
                return (
                  <ToggleButton
                    key={slot.start}
                    data-testid="booking-slot-time"
                    data-start={slot.start}
                    aria-label={labels.timeAccessible(
                      describe(slot.start, longDay)
                    )}
                    isSelected={isSelected}
                    onChange={() => onSelect(slot)}
                    className={cn(
                      "flex min-h-11 items-center justify-center rounded-full border text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input-border bg-background hover:border-primary hover:bg-teal-50 dark:hover:bg-teal-950"
                    )}
                  >
                    {timeFormat.format(new Date(slot.start))}
                  </ToggleButton>
                )
              })}
              {hidden > 0 || canCollapse ? (
                <button
                  type="button"
                  onClick={() => toggleDay(day.dateKey)}
                  className={MORE_BUTTON}
                >
                  {hidden > 0 ? labels.more(hidden) : labels.less}
                </button>
              ) : null}
            </div>
          )
        })}
        <div className="flex w-28 shrink-0 snap-start items-start pt-[3.25rem]">
          <Button
            variant="outline"
            className="min-h-11 w-full rounded-full text-sm"
            data-testid="booking-slot-next"
            onPress={onLaterDates}
          >
            {labels.laterDates}
          </Button>
        </div>
      </div>

      {selectedStart ? (
        <div className="max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-40 max-sm:border-t max-sm:bg-background/95 max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:shadow-3 max-sm:backdrop-blur [&>*]:w-full">
          {continueAction(describe(selectedStart, shortDay))}
        </div>
      ) : null}

      <p role="status" className="sr-only">
        {selectedStart ? labels.selected(describe(selectedStart, longDay)) : ""}
      </p>
    </div>
  )
}

/** "Choose a date": any day from today; the strip then starts there. */
function JumpCalendar({
  locale,
  timeZone,
  label,
  previous,
  next,
  onPick,
}: {
  locale: string
  timeZone: string
  label: string
  previous: string
  next: string
  onPick: (dateKey: string) => void
}) {
  const start = today(timeZone)
  return (
    <I18nProvider locale={locale}>
      <Calendar
        aria-label={label}
        minValue={start}
        defaultFocusedValue={start}
        onChange={(date) => onPick(date.toString())}
        className="w-[19rem]"
      >
        <header className="mb-2 flex items-center justify-between">
          <Button
            slot="previous"
            variant="ghost"
            size="icon"
            aria-label={previous}
            className="size-11 rounded-full"
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <Heading className="font-medium first-letter:uppercase" />
          <Button
            slot="next"
            variant="ghost"
            size="icon"
            aria-label={next}
            className="size-11 rounded-full"
          >
            <ArrowRightIcon className="size-4" />
          </Button>
        </header>
        <CalendarGrid className="w-full border-collapse">
          <CalendarGridHeader>
            {(day) => (
              <CalendarHeaderCell className="pb-1 text-xs font-medium text-muted-foreground">
                {day}
              </CalendarHeaderCell>
            )}
          </CalendarGridHeader>
          <CalendarGridBody>
            {(date) => (
              <CalendarCell
                date={date}
                className={({ isOutsideMonth, isDisabled, isFocusVisible }) =>
                  cn(
                    "mx-auto flex size-10 items-center justify-center rounded-full text-sm tabular-nums outline-none select-none",
                    isOutsideMonth && "invisible",
                    isDisabled
                      ? "text-muted-foreground/60"
                      : "cursor-pointer hover:bg-muted",
                    isFocusVisible && "ring-3 ring-ring/50"
                  )
                }
              />
            )}
          </CalendarGridBody>
        </CalendarGrid>
      </Calendar>
    </I18nProvider>
  )
}
