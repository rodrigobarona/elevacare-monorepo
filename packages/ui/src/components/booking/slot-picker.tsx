"use client"

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"
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
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDotsIcon,
  InfoIcon,
  MoonIcon,
  SunHorizonIcon,
  SunIcon,
} from "@eleva/icons"
import { Skeleton } from "@eleva/ui/components/skeleton"

/** The strip always shows at least a week, empty days included. */
const MIN_DAYS = 7

type PartOfDay = "morning" | "afternoon" | "evening"

const PART_ICONS = {
  morning: SunHorizonIcon,
  afternoon: SunIcon,
  evening: MoonIcon,
} as const

/** Morning before 12:00, afternoon before 18:00, evening after. */
function partOfDay(hour: number): PartOfDay {
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
}

/**
 * Pick a time in two taps (Alan, Walmart, Future Pro): a row of day chips,
 * empty days greyed out, then every time of the chosen day grouped Morning,
 * Afternoon and Evening. The month is named above the chips. The continue
 * action is in place from the start, disabled until a time is chosen: a
 * fixed bar on phones (with room kept below the picker) and sticky at the
 * bottom of the column on larger screens.
 */
export function SlotPicker({
  slots,
  timeZone,
  locale,
  fromKey,
  isLoading = false,
  isError = false,
  onRetry,
  errorHelp,
  selectedStart,
  onSelect,
  onLaterDates,
  onJumpTo,
  earliest,
  onSelectEarliest,
  continueAction,
  backAction,
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
  /** Times could not be loaded: never present that as "no times". */
  isError?: boolean
  onRetry?: () => void
  /** A way out when retrying keeps failing, e.g. a help link. */
  errorHelp?: ReactNode
  selectedStart: string | null
  onSelect: (slot: FunnelSlot) => void
  /** Load the weeks after the loaded window. */
  onLaterDates: () => void
  /** Load times from a chosen day onwards. */
  onJumpTo: (dateKey: string) => void
  /** Earliest open time for this booking, from any window. */
  earliest: FunnelSlot | null
  onSelectEarliest: (slot: FunnelSlot) => void
  /**
   * Receives the selection as "Tue 10 Nov, 10:00", or null before a time is
   * chosen (render the action disabled then, so the next step is visible).
   */
  continueAction: (when: string | null) => ReactNode
  /** Shown beside the continue action on larger screens. */
  backAction?: ReactNode
  labels: {
    /** Name of the day row, e.g. "Days". */
    strip: string
    /** Scroll the day row back / on. */
    earlierDays: string
    laterDays: string
    /** Calendar months. */
    previous: string
    next: string
    today: string
    tomorrow: string
    morning: string
    afternoon: string
    evening: string
    /** "Monday 16 November, no times". */
    noTimes: (day: string) => string
    laterDates: string
    chooseDate: string
    calendar: string
    empty: string
    loadError: string
    retry: string
    /** "The first open day from Wed 2 Dec is Fri 4 Dec." */
    skippedTo: (from: string, to: string) => string
    /** "Next available: Mon 9 Nov, 14:30". */
    nextAvailable: (when: string) => string
    /** "Choose Tuesday 10 November, 10:00". */
    timeAccessible: (when: string) => string
    /** "Tuesday 10 November, 10:00 selected". */
    selected: (when: string) => string
  }
  className?: string
}) {
  const stripRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const dayHeadingRef = useRef<HTMLHeadingElement>(null)
  const panelId = useId()
  // The day the member tapped, for the window it was tapped in.
  const [chosen, setChosen] = useState<{ fromKey: string; day: string } | null>(
    null
  )
  const [focusStart, setFocusStart] = useState<string | null>(null)

  const todayKey = dateKeyInZone(new Date().toISOString(), timeZone)
  const showDays = !isLoading && !isError
  const openDays = showDays
    ? groupSlotsByDay(slots, timeZone).filter((day) => day.dateKey >= fromKey)
    : []
  const slotsByDay = new Map(openDays.map((day) => [day.dateKey, day.slots]))
  // The row starts at the first open day (earlier days of the window have
  // nothing to offer) and runs at least a week, so gaps show greyed.
  const firstKey = openDays[0]?.dateKey ?? fromKey
  const lastOpen = openDays.at(-1)?.dateKey ?? firstKey
  const minLast = addDaysToKey(firstKey, MIN_DAYS - 1)
  const lastKey = lastOpen > minLast ? lastOpen : minLast
  const dayKeys: string[] = []
  if (openDays.length > 0) {
    for (let key = firstKey; key <= lastKey; key = addDaysToKey(key, 1)) {
      dayKeys.push(key)
    }
  }

  const selectedDay = selectedStart
    ? dateKeyInZone(selectedStart, timeZone)
    : null
  const chosenDay = chosen?.fromKey === fromKey ? chosen.day : null
  const activeDay =
    chosenDay && slotsByDay.has(chosenDay)
      ? chosenDay
      : selectedDay && slotsByDay.has(selectedDay)
        ? selectedDay
        : (openDays[0]?.dateKey ?? null)
  const activeSlots = activeDay ? (slotsByDay.get(activeDay) ?? []) : []

  // Day keys are civil dates: format them at noon UTC so no zone shifts them.
  const keyDate = (key: string) => new Date(`${key}T12:00:00Z`)
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  })
  const dayNumber = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    timeZone: "UTC",
  })
  const monthShort = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  })
  const monthYear = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
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
  const hourFormat = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone,
  })
  const describe = (iso: string, format: Intl.DateTimeFormat) =>
    `${format.format(new Date(iso))}, ${timeFormat.format(new Date(iso))}`

  const relativeName = (key: string) =>
    key === todayKey
      ? labels.today
      : key === addDaysToKey(todayKey, 1)
        ? labels.tomorrow
        : null

  const groups = (["morning", "afternoon", "evening"] as const)
    .map((part) => ({
      part,
      slots: activeSlots.filter(
        (slot) =>
          partOfDay(Number(hourFormat.format(new Date(slot.start)))) === part
      ),
    }))
    .filter((group) => group.slots.length > 0)

  // A new window starts with the row at its start.
  useEffect(() => {
    stripRef.current?.scrollTo({ left: 0 })
  }, [fromKey])

  // Keep the active day's chip in view in the row.
  useEffect(() => {
    if (!activeDay) return
    const chip = stripRef.current?.querySelector<HTMLElement>(
      `[data-day="${CSS.escape(activeDay)}"]`
    )
    chip?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeDay])

  // Focus moves only when the member asked for "Next available": to that
  // time once it has loaded, or to the day if it was taken meanwhile.
  useEffect(() => {
    if (!focusStart || isLoading) return
    const target = rootRef.current?.querySelector<HTMLElement>(
      `[data-start="${CSS.escape(focusStart)}"]`
    )
    const fallback = dayHeadingRef.current ?? rootRef.current
    const element = target ?? fallback
    element?.focus({ preventScroll: true })
    element?.scrollIntoView({ block: "center" })
    setFocusStart(null)
  }, [focusStart, isLoading, slots])

  // The phone action bar is always there: keep focused content clear of it
  // (WCAG 2.4.11).
  useEffect(() => {
    const root = document.documentElement
    const phone = window.matchMedia("(max-width: 639px)")
    const update = () => {
      root.style.scrollPaddingBottom = phone.matches ? "7rem" : "5.5rem"
    }
    update()
    phone.addEventListener("change", update)
    return () => {
      phone.removeEventListener("change", update)
      root.style.scrollPaddingBottom = ""
    }
  }, [])

  function scrollStrip(direction: 1 | -1) {
    const strip = stripRef.current
    if (!strip) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    strip.scrollBy({
      left: direction * strip.clientWidth * 0.8,
      behavior: reduce.matches ? "auto" : "smooth",
    })
  }

  // One Tab stop for the row; arrow keys move between open days.
  function onDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, key: string) {
    const open = dayKeys.filter((day) => slotsByDay.has(day))
    const index = open.indexOf(key)
    const target =
      event.key === "ArrowRight"
        ? open[index + 1]
        : event.key === "ArrowLeft"
          ? open[index - 1]
          : event.key === "Home"
            ? open[0]
            : event.key === "End"
              ? open.at(-1)
              : undefined
    if (!target) return
    event.preventDefault()
    setChosen({ fromKey, day: target })
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-day="${CSS.escape(target)}"]`)
      ?.focus()
  }

  // Offered when it is outside this window: after "Later dates", or when
  // this window has nothing.
  const earliestDay = earliest ? dateKeyInZone(earliest.start, timeZone) : null
  const earliestElsewhere =
    earliest != null &&
    earliestDay != null &&
    (earliestDay < fromKey || (showDays && openDays.length === 0))
  const nextAvailable =
    earliest && earliestElsewhere ? (
      <button
        type="button"
        data-testid="booking-next-available"
        className="inline-flex min-h-6 items-center gap-1.5 rounded-sm text-sm font-medium whitespace-nowrap text-primary underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={() => {
          onSelectEarliest(earliest)
          setFocusStart(earliest.start)
        }}
      >
        <CalendarDotsIcon aria-hidden className="size-4" />
        {labels.nextAvailable(describe(earliest.start, shortDay))}
      </button>
    ) : null

  const monthLabel = monthYear.format(
    keyDate(showDays && activeDay ? activeDay : fromKey)
  )
  const isEmpty = showDays && openDays.length === 0
  // After a jump or "Later dates", say when the first days had nothing.
  const shortDayOfKey = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
  const skippedFrom =
    showDays && openDays.length > 0 && fromKey > todayKey && firstKey > fromKey
      ? labels.skippedTo(
          shortDayOfKey.format(keyDate(fromKey)),
          shortDayOfKey.format(keyDate(firstKey))
        )
      : null
  const dayTitle = activeDay
    ? [relativeName(activeDay), longDayOfKey.format(keyDate(activeDay))]
        .filter(Boolean)
        .join(" · ")
    : null

  return (
    <div
      ref={rootRef}
      data-slot="slot-picker"
      tabIndex={-1}
      className={cn(
        "flex flex-col gap-4 outline-none max-sm:pb-28 sm:gap-5",
        className
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className="min-w-0 font-display text-xl font-medium first-letter:uppercase"
            data-testid="booking-slot-month"
          >
            {monthLabel}
          </p>
          <div className="flex shrink-0 items-center gap-1">
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
              className={cn(
                "size-11 rounded-full max-sm:hidden",
                !showDays && "hidden"
              )}
              onPress={() => scrollStrip(-1)}
            >
              <ArrowLeftIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={labels.laterDays}
              className={cn(
                "size-11 rounded-full max-sm:hidden",
                !showDays && "hidden"
              )}
              onPress={() => scrollStrip(1)}
            >
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        </div>
        {nextAvailable}
      </div>

      {isError ? (
        <div
          role="alert"
          data-testid="booking-slots-error"
          className="space-y-3 rounded-3xl bg-muted/60 p-5 text-sm"
        >
          <p className="flex items-start gap-2 font-medium">
            <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {labels.loadError}
          </p>
          {onRetry ? (
            <Button
              variant="outline"
              className="min-h-11 rounded-full"
              onPress={() => {
                // The button goes away while times reload: keep focus here.
                rootRef.current?.focus({ preventScroll: true })
                onRetry()
              }}
            >
              {labels.retry}
            </Button>
          ) : null}
          {errorHelp ? (
            <p className="text-muted-foreground">{errorHelp}</p>
          ) : null}
        </div>
      ) : (
        <>
          <div
            ref={stripRef}
            // A toolbar: arrow keys move between days.
            role="toolbar"
            aria-orientation="horizontal"
            aria-label={labels.strip}
            aria-busy={isLoading || undefined}
            // No scroll anchoring: days load in front of "Later dates" and
            // the row must stay at its first day. Full bleed on phones.
            className="-mx-1 -my-1 flex snap-x scroll-px-1 [scrollbar-width:none] gap-2 overflow-x-auto px-1 py-1 [overflow-anchor:none] max-sm:-mx-4 max-sm:scroll-px-4 max-sm:px-4 sm:[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] sm:pr-10 [&::-webkit-scrollbar]:hidden"
          >
            {isLoading ? (
              <DaySkeleton />
            ) : (
              dayKeys.map((key) => {
                const isOpenDay = slotsByDay.has(key)
                const isActive = key === activeDay
                const holdsSelection = key === selectedDay
                const date = keyDate(key)
                const showMonth = key === dayKeys[0] || key.endsWith("-01")
                return (
                  <button
                    key={key}
                    type="button"
                    data-day={key}
                    data-testid={
                      isOpenDay ? "booking-slot-day" : "booking-slot-day-empty"
                    }
                    disabled={!isOpenDay}
                    tabIndex={isOpenDay && isActive ? 0 : -1}
                    aria-pressed={isOpenDay ? isActive : undefined}
                    aria-controls={isOpenDay ? panelId : undefined}
                    aria-label={
                      isOpenDay
                        ? longDayOfKey.format(date)
                        : labels.noTimes(longDayOfKey.format(date))
                    }
                    onClick={() => setChosen({ fromKey, day: key })}
                    onKeyDown={(event) => onDayKeyDown(event, key)}
                    className={cn(
                      "relative flex min-h-16 w-14 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl border text-center transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-[4.5rem] sm:w-16",
                      isActive
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                        : isOpenDay
                          ? "border-border bg-card hover:border-primary"
                          : "cursor-not-allowed border-transparent bg-transparent text-muted-foreground"
                    )}
                  >
                    <span className="text-xs font-medium first-letter:uppercase">
                      {weekday.format(date)}
                    </span>
                    <span
                      className={cn(
                        "text-lg leading-none tabular-nums",
                        isOpenDay
                          ? "font-semibold"
                          : "font-normal line-through decoration-1"
                      )}
                    >
                      {dayNumber.format(date)}
                    </span>
                    {showMonth ? (
                      <span className="text-[0.6875rem] leading-none">
                        {monthShort.format(date)}
                      </span>
                    ) : null}
                    {holdsSelection && !isActive ? (
                      <span
                        aria-hidden
                        className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary"
                      />
                    ) : null}
                  </button>
                )
              })
            )}
            {showDays && openDays.length > 0 ? (
              <button
                type="button"
                data-testid="booking-slot-next"
                onClick={onLaterDates}
                className="flex min-h-16 w-24 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card px-2 text-center text-sm font-medium text-primary transition-colors outline-none hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-[4.5rem]"
              >
                {labels.laterDates}
                <ArrowRightIcon aria-hidden className="size-4" />
              </button>
            ) : null}
          </div>

          <section
            id={panelId}
            aria-labelledby={dayTitle ? `${panelId}-day` : undefined}
            aria-label={dayTitle ? undefined : labels.strip}
            className="min-h-40 sm:min-h-28"
          >
            {isLoading ? (
              <TimesSkeleton />
            ) : isEmpty ? (
              <div className="space-y-3 rounded-3xl bg-muted/60 p-5 text-sm">
                <p>{labels.empty}</p>
                <Button
                  variant="outline"
                  className="min-h-11 rounded-full"
                  data-testid="booking-slot-next"
                  onPress={onLaterDates}
                >
                  {labels.laterDates}
                </Button>
              </div>
            ) : dayTitle ? (
              <div className="space-y-4 sm:space-y-5">
                {skippedFrom ? (
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="booking-slot-skipped"
                  >
                    {skippedFrom}
                  </p>
                ) : null}
                <h2
                  ref={dayHeadingRef}
                  id={`${panelId}-day`}
                  tabIndex={-1}
                  className="text-base font-medium outline-none first-letter:uppercase"
                >
                  {dayTitle}
                </h2>
                {groups.map((group) => {
                  const Icon = PART_ICONS[group.part]
                  const groupId = `${panelId}-${group.part}`
                  return (
                    <div
                      key={group.part}
                      role="group"
                      aria-labelledby={groupId}
                      className="space-y-2"
                    >
                      <h3
                        id={groupId}
                        className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                      >
                        <Icon aria-hidden className="size-4" />
                        {labels[group.part]}
                      </h3>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {group.slots.map((slot) => {
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
                                "flex min-h-12 items-center justify-center rounded-full border text-base font-medium tabular-nums transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card hover:border-primary hover:text-primary"
                              )}
                            >
                              {timeFormat.format(new Date(slot.start))}
                            </ToggleButton>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </section>
        </>
      )}

      <div className="flex items-center gap-3 sm:sticky sm:bottom-0 sm:z-10 sm:-mx-2 sm:border-t sm:border-border sm:bg-background sm:px-2 sm:py-3">
        {backAction ? <div className="max-sm:order-2">{backAction}</div> : null}
        <div
          data-testid="booking-when-bar"
          className="max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-40 max-sm:border-t max-sm:bg-background max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:shadow-3 max-sm:[&>*]:w-full"
        >
          {continueAction(
            selectedStart ? describe(selectedStart, shortDay) : null
          )}
        </div>
      </div>

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
                    isFocusVisible &&
                      "outline-2 outline-offset-2 outline-primary"
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

/** Day chips and two groups of time placeholders while times load. */
function DaySkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5, 6].map((day) => (
        <Skeleton
          key={day}
          aria-hidden
          data-testid="booking-slots-skeleton"
          className="h-16 w-14 shrink-0 rounded-2xl sm:h-[4.5rem] sm:w-16"
        />
      ))}
    </>
  )
}

function TimesSkeleton() {
  return (
    <div aria-hidden className="space-y-5">
      <Skeleton className="h-4 w-40 rounded-full" />
      {[0, 1].map((group) => (
        <div key={group} className="space-y-2">
          <Skeleton className="h-3 w-24 rounded-full" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((time) => (
              <Skeleton key={time} className="h-12 rounded-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
