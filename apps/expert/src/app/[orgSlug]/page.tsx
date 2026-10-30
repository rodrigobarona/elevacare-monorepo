import type { ReactNode } from "react"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import {
  getLatestPartnerApplication,
  listExpertBookings,
  listExpertEventTypes,
} from "@eleva/db"
import type { ExpertBookingListItem } from "@eleva/db"
import { expertProfileUrl } from "@eleva/config/env"
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CalendarDotsIcon,
  ClockIcon,
  ListChecksIcon,
  PlusIcon,
  WalletIcon,
} from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { DateTile } from "@eleva/ui/components/date-tile"
import { EmptyState } from "@eleva/ui/components/empty-state"
import {
  PageHeader,
  Section,
  Stat,
  StatGrid,
} from "@eleva/ui/components/page-header"
import { StatusPill } from "@eleva/ui/components/status-pill"
import type { StatusTone } from "@eleva/ui/components/status-pill"
import { bookingDateParts } from "@eleva/ui/lib/booking/date-parts"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { licenceVerificationState } from "@/lib/licence-verification"
import { expertWorkspaceBase } from "@/lib/workspace-paths"
import { DashboardRequestActions } from "./_components/dashboard-request-actions"
import { LicenceVerificationNotice } from "./_components/licence-verification-notice"

export const dynamic = "force-dynamic"

const DAY_MS = 24 * 60 * 60 * 1000
const HORIZON_DAYS = 14
const UPCOMING_LIMIT = 6

type LocalizedText = { en: string; pt?: string; es?: string }
type StatusKey = "confirmed" | "completed" | "awaitingPayment"

function localized(text: LocalizedText, locale: string): string {
  return text[locale as keyof LocalizedText] ?? text.en
}

function statusDisplay(
  status: string
): { key: StatusKey; tone: StatusTone } | null {
  switch (status) {
    case "confirmed":
    case "rescheduled":
      return { key: "confirmed", tone: "positive" }
    case "completed":
      return { key: "completed", tone: "neutral" }
    case "slot_reserved":
    case "awaiting_payment":
    case "reserved":
    case "pending_payment":
      return { key: "awaitingPayment", tone: "attention" }
    default:
      return null
  }
}

export default async function ExpertDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { session, profile } = await loadExpertWorkspace(
    orgSlug,
    "events:manage"
  )
  const base = expertWorkspaceBase(session)

  const now = new Date()
  const weekEnd = new Date(now.getTime() + 7 * DAY_MS)
  const horizon = new Date(now.getTime() + HORIZON_DAYS * DAY_MS)

  const [bookings, eventTypes, application, t, tCalendar, locale] =
    await Promise.all([
      listExpertBookings(profile.orgId, profile.id, now, horizon),
      listExpertEventTypes(profile.orgId, profile.id),
      getLatestPartnerApplication(profile.orgId, profile.id),
      getTranslations("dashboard.expert"),
      getTranslations("calendar"),
      getLocale(),
    ])

  const requests: ExpertBookingListItem[] = []
  const upcoming: ExpertBookingListItem[] = []
  for (const booking of bookings) {
    if (booking.status === "awaiting_confirmation") requests.push(booking)
    else upcoming.push(booking)
  }
  const weekCount = upcoming.filter((b) => b.startsAt < weekEnd).length
  const publishedCount = eventTypes.filter((et) => et.published).length

  const displayName = profile.displayName.trim()
  const profileUrl = expertProfileUrl(locale, profile.username)

  const modeText = (booking: ExpertBookingListItem): string => {
    if (booking.modeLabel) return localized(booking.modeLabel, locale)
    switch (booking.sessionMode) {
      case "online":
        return t("modeOnline")
      case "in_person":
        return t("modeInPerson")
      case "phone":
        return t("modePhone")
      default: {
        const unreachable: never = booking.sessionMode
        return unreachable
      }
    }
  }

  const bookingSummary = (booking: ExpertBookingListItem) => {
    const parts = bookingDateParts(
      booking.startsAt.toISOString(),
      booking.endsAt.toISOString(),
      locale,
      profile.timezone ?? booking.timezone
    )
    return {
      parts,
      title: localized(booking.eventTypeTitle, locale),
      member: booking.memberFirstName ?? tCalendar("memberUnknown"),
      mode: modeText(booking),
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <LicenceVerificationNotice
        state={licenceVerificationState(profile, application)}
        href={`${base}/licence`}
      />
      <PageHeader
        eyebrow={t("eyebrow")}
        title={
          displayName ? t("welcome", { name: displayName }) : t("welcomeBack")
        }
        description={t("subtitle")}
        actions={
          <>
            <LinkButton variant="outline" href={profileUrl}>
              {t("viewProfile")}
            </LinkButton>
            <LinkButton href={`${base}/event-types/new`}>
              <PlusIcon aria-hidden />
              {t("newService")}
            </LinkButton>
          </>
        }
        className="mb-0"
      />

      <StatGrid className="grid-cols-3 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3">
        <Stat label={t("stats.week")} value={weekCount} />
        <Stat label={t("stats.requests")} value={requests.length} />
        <Stat
          label={t("stats.services")}
          value={publishedCount}
          hint={t("stats.servicesHint", { total: eventTypes.length })}
        />
      </StatGrid>

      {requests.length > 0 ? (
        <Section title={t("requestsTitle")} description={t("requestsHint")}>
          <ul className="grid gap-3">
            {requests.map((booking) => {
              const { parts, title, member, mode } = bookingSummary(booking)
              const deadline = booking.approvalDeadlineAt
                ? new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: profile.timezone ?? booking.timezone,
                  }).format(booking.approvalDeadlineAt)
                : null
              return (
                <li
                  key={booking.id}
                  data-testid="expert-dashboard-request"
                  className="rounded-3xl border border-coral-200 bg-card p-5 shadow-1 sm:p-6 dark:border-coral-900"
                >
                  <div className="flex gap-4">
                    <DateTile
                      month={parts.month}
                      day={parts.day}
                      weekday={parts.weekday}
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <h3 className="font-display text-lg leading-snug font-medium">
                        {title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        <span className="sr-only">{parts.longDate} · </span>
                        {member} · {mode} · {parts.timeRange}
                      </p>
                      {deadline ? (
                        <StatusPill tone="attention">
                          <ClockIcon aria-hidden className="mr-1 size-3.5" />
                          {t("respondBy", { date: deadline })}
                        </StatusPill>
                      ) : null}
                    </div>
                  </div>
                  <DashboardRequestActions bookingId={booking.id} />
                </li>
              )
            })}
          </ul>
        </Section>
      ) : null}

      <Section
        title={t("upcomingTitle")}
        actions={
          <LinkButton variant="ghost" size="sm" href={`${base}/calendar`}>
            {t("openCalendar")}
            <ArrowRightIcon aria-hidden />
          </LinkButton>
        }
      >
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarDotsIcon />}
            title={t("upcomingEmpty")}
            description={t("upcomingEmptyHint")}
            action={
              <LinkButton variant="outline" href={profileUrl}>
                {t("viewProfile")}
              </LinkButton>
            }
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card shadow-1">
            {upcoming.slice(0, UPCOMING_LIMIT).map((booking) => {
              const { parts, title, member, mode } = bookingSummary(booking)
              const status = statusDisplay(booking.status)
              return (
                <li
                  key={booking.id}
                  data-testid="expert-dashboard-session"
                  className="flex items-center gap-4 p-4 sm:px-6"
                >
                  <DateTile
                    month={parts.month}
                    day={parts.day}
                    weekday={parts.weekday}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium text-foreground">
                      {title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="sr-only">{parts.longDate} · </span>
                      {member} · {mode}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-sm font-medium text-foreground tabular-nums">
                      {parts.time}
                    </span>
                    {status ? (
                      <StatusPill tone={status.tone}>
                        {t(`status.${status.key}`)}
                      </StatusPill>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title={t("shortcutsTitle")}>
        <ul className="grid gap-3 sm:grid-cols-2">
          <Shortcut
            href={`${base}/event-types`}
            icon={<ListChecksIcon />}
            title={t("shortcuts.services")}
            description={t("shortcuts.servicesHint")}
          />
          <Shortcut
            href={`${base}/schedule`}
            icon={<ClockIcon />}
            title={t("shortcuts.schedule")}
            description={t("shortcuts.scheduleHint")}
          />
          <Shortcut
            href={`${base}/calendars`}
            icon={<CalendarCheckIcon />}
            title={t("shortcuts.calendars")}
            description={t("shortcuts.calendarsHint")}
          />
          <Shortcut
            href={`${base}/finance`}
            icon={<WalletIcon />}
            title={t("shortcuts.finance")}
            description={t("shortcuts.financeHint")}
          />
        </ul>
      </Section>
    </div>
  )
}

function Shortcut({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-1 transition-shadow outline-none hover:shadow-2 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200 [&_svg]:size-5">
          {icon}
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block font-medium text-foreground">{title}</span>
          <span className="block text-sm text-muted-foreground">
            {description}
          </span>
        </span>
        <ArrowRightIcon
          aria-hidden
          className="mt-0.5 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  )
}
