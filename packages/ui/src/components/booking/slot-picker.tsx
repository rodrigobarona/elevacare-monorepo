"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Heading,
  I18nProvider,
  ToggleButton,
} from "react-aria-components"
import { parseDate, today, type CalendarDate } from "@internationalized/date"
import { Button } from "@eleva/ui/components/button"
import {
  dateKeyInZone,
  groupSlotsByDay,
  groupSlotsByDayPart,
  monthOfDateKey,
  type DayPart,
  type FunnelSlot,
} from "@eleva/ui/lib/booking/slot-groups"
import { cn } from "@eleva/ui/lib/utils"
import { ArrowLeftIcon, ArrowRightIcon, CalendarDotsIcon } from "@eleva/icons"

/**
 * Pick a time: a React Aria calendar (one tab stop, arrow keys, PageUp /
 * PageDown for months, week start from the locale) beside the chosen day's
 * times, grouped Morning / Afternoon / Evening. Pressing a day shows its
 * times and never picks one. The continue action sits right after the
 * group holding the selected time, and is a sticky bar on phones.
 */
export function SlotPicker({
  slots,
  timeZone,
  locale,
  selectedStart,
  onSelect,
  month,
  onMonthChange,
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
  selectedStart: string | null
  /** `null` clears the time, e.g. when another day is pressed. */
  onSelect: (slot: FunnelSlot | null) => void
  /** UTC start of the visible month. */
  month: Date
  onMonthChange: (next: Date) => void
  /** Earliest open time for this booking, from any month. */
  earliest: FunnelSlot | null
  onSelectEarliest: (slot: FunnelSlot) => void
  /**
   * Rendered after the selected time's group, e.g. the Continue button;
   * receives the selection as "Mon 9 Nov, 13:00".
   */
  continueAction: (when: string) => ReactNode
  labels: {
    /** Accessible name of the calendar, e.g. "Choose a day". */
    calendar: string
    previous: string
    next: string
    empty: string
    /** "Times on Monday 9 November". */
    timesFor: (date: string) => string
    dayParts: Record<DayPart, string>
    /** "Next available: Mon 9 Nov, 09:00". */
    nextAvailable: (when: string) => string
    /** "Monday 9 November, 13:00 selected". */
    selected: (when: string) => string
  }
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const timesRef = useRef<HTMLDivElement>(null)
  const timesHeadingId = useId()
  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const [focused, setFocused] = useState<CalendarDate | null>(null)
  const [focusStart, setFocusStart] = useState<string | null>(null)
  const [scrollToTimes, setScrollToTimes] = useState(0)

  const monthKey = month.toISOString().slice(0, 7)
  const groups = groupSlotsByDay(slots, timeZone)
  const byDay = new Map(groups.map((group) => [group.dateKey, group.slots]))
  const monthDays = groups
    .map((group) => group.dateKey)
    .filter((key) => key.startsWith(monthKey))
  const selectedDay = selectedStart
    ? dateKeyInZone(selectedStart, timeZone)
    : null
  const activeDay =
    selectedDay && byDay.has(selectedDay)
      ? selectedDay
      : pickedDay && byDay.has(pickedDay) && pickedDay.startsWith(monthKey)
        ? pickedDay
        : (monthDays[0] ?? null)
  const daySlots = activeDay ? (byDay.get(activeDay) ?? []) : []
  const parts = groupSlotsByDayPart(daySlots, timeZone)

  const activeDate = activeDay ? parseDate(activeDay) : null
  const focusedValue =
    focused && focused.toString().startsWith(monthKey)
      ? focused
      : (activeDate ?? parseDate(`${monthKey}-01`))

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

  // "Next available" is the one place focus moves: the member asked for it.
  useEffect(() => {
    if (!focusStart) return
    const target = rootRef.current?.querySelector<HTMLElement>(
      `[data-start="${CSS.escape(focusStart)}"]`
    )
    if (!target) return
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: "center" })
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

  // On phones the times sit under the calendar: bring them into view.
  useEffect(() => {
    if (scrollToTimes === 0) return
    if (!window.matchMedia("(max-width: 639px)").matches) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    timesRef.current?.scrollIntoView({
      block: "start",
      behavior: reduce.matches ? "auto" : "smooth",
    })
  }, [scrollToTimes])

  function pressDay(key: string) {
    setPickedDay(key)
    if (selectedDay !== key) onSelect(null)
    setScrollToTimes((count) => count + 1)
  }

  return (
    <div
      ref={rootRef}
      data-slot="slot-picker"
      className={cn("flex flex-col gap-6", className)}
    >
      {earliest ? (
        <Button
          variant="outline"
          className="min-h-11 self-start rounded-full"
          data-testid="booking-next-available"
          onPress={() => {
            setPickedDay(null)
            onSelectEarliest(earliest)
            setFocusStart(earliest.start)
          }}
        >
          <CalendarDotsIcon data-icon="inline-start" />
          {labels.nextAvailable(describe(earliest.start, shortDay))}
        </Button>
      ) : null}

      <I18nProvider locale={locale}>
        <Calendar
          aria-label={labels.calendar}
          value={activeDate}
          onChange={(date) => pressDay(date.toString())}
          focusedValue={focusedValue}
          onFocusChange={(date) => {
            setFocused(date)
            const key = date.toString().slice(0, 7)
            if (key !== monthKey) {
              setPickedDay(null)
              onMonthChange(monthOfDateKey(date.toString()))
            }
          }}
          minValue={today(timeZone)}
          isDateUnavailable={(date) => !byDay.has(date.toString())}
          className="w-full max-w-sm"
        >
          <header className="mb-2 flex items-center justify-between">
            <Button
              slot="previous"
              variant="ghost"
              size="icon"
              aria-label={labels.previous}
              className="size-11 rounded-full"
            >
              <ArrowLeftIcon className="size-4" />
            </Button>
            <Heading className="font-medium first-letter:uppercase" />
            <Button
              slot="next"
              variant="ghost"
              size="icon"
              aria-label={labels.next}
              data-testid="booking-slot-next"
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
              {(date) => {
                const isOpen =
                  byDay.has(date.toString()) &&
                  date.toString().startsWith(monthKey)
                return (
                  <CalendarCell
                    date={date}
                    data-testid={isOpen ? "booking-slot-day" : undefined}
                    className={({
                      isSelected,
                      isUnavailable,
                      isOutsideMonth,
                      isFocusVisible,
                      isDisabled,
                    }) =>
                      cn(
                        "relative mx-auto flex size-11 flex-col items-center justify-center rounded-full text-sm tabular-nums outline-none select-none",
                        isOutsideMonth && "invisible",
                        isUnavailable || isDisabled
                          ? "cursor-default text-muted-foreground"
                          : "cursor-pointer font-semibold after:absolute after:bottom-1.5 after:size-1 after:rounded-full after:bg-primary hover:bg-muted",
                        isSelected &&
                          "bg-primary text-primary-foreground after:bg-primary-foreground hover:bg-primary",
                        isFocusVisible && "ring-3 ring-ring/50"
                      )
                    }
                  />
                )
              }}
            </CalendarGridBody>
          </CalendarGrid>
        </Calendar>
      </I18nProvider>

      <div
        ref={timesRef}
        className="flex scroll-mt-20 flex-col gap-4"
        role="group"
        aria-labelledby={timesHeadingId}
      >
        <p id={timesHeadingId} className="text-sm font-medium">
          {activeDay && daySlots.length > 0
            ? labels.timesFor(
                longDay.format(new Date(`${activeDay}T12:00:00Z`))
              )
            : labels.empty}
        </p>
        {parts.map((part) => {
          const holdsSelection = part.slots.some(
            (slot) => slot.start === selectedStart
          )
          return (
            <div key={part.part} className="flex flex-col gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {labels.dayParts[part.part]}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {part.slots.map((slot) => {
                  const isSelected = selectedStart === slot.start
                  return (
                    <ToggleButton
                      key={slot.start}
                      data-testid="booking-slot-time"
                      data-start={slot.start}
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
              </div>
              {holdsSelection ? (
                <div className="max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-40 max-sm:border-t max-sm:bg-background/95 max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:shadow-3 max-sm:backdrop-blur sm:pt-2 [&>*]:w-full">
                  {selectedStart
                    ? continueAction(describe(selectedStart, shortDay))
                    : null}
                </div>
              ) : null}
            </div>
          )
        })}
        {/* Keeps the last times clear of the phone action bar (WCAG 2.4.11). */}
        {selectedStart ? <div aria-hidden className="h-20 sm:hidden" /> : null}
      </div>

      <p role="status" className="sr-only">
        {selectedStart ? labels.selected(describe(selectedStart, longDay)) : ""}
      </p>
    </div>
  )
}
