import { getLocale, getTranslations } from "next-intl/server"
import { CalendarDotsIcon, ClockIcon } from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader, Section } from "@eleva/ui/components/page-header"
import { marketplaceExpertsUrl } from "@eleva/config/env"
import { getAuthedApiClient, requireMemberSpace } from "@/lib/member-api"
import { BookingCard, FindExpertButton } from "./_components/booking-card"
import { SPACE_BASE } from "@eleva/config/routing"

export const dynamic = "force-dynamic"

/** Past sessions shown on home; the rest are on Sessions. */
const PAST_ON_HOME = 5

export default async function OrgHomePage() {
  const session = await requireMemberSpace()
  const [t, locale, api] = await Promise.all([
    getTranslations("home"),
    getLocale(),
    getAuthedApiClient(),
  ])
  const [upcoming, past] = await Promise.all([
    api.me.listBookings({ range: "upcoming" }),
    api.me.listBookings({ range: "past" }),
  ])
  const expertsUrl = marketplaceExpertsUrl(locale)
  const memberName = session.user.displayName ?? session.user.email
  const firstName = session.user.displayName?.trim().split(/\s+/)[0]
  const [next, ...later] = upcoming.bookings

  return (
    <div className="space-y-12" data-testid="member-space-home">
      <PageHeader
        title={firstName ? t("welcome", { name: firstName }) : t("welcomeBack")}
        actions={<FindExpertButton href={expertsUrl} />}
      />

      <Section title={t("upcomingTitle")}>
        {next ? (
          <div className="grid gap-3">
            <BookingCard
              booking={next}
              memberName={memberName}
              memberEmail={session.user.email}
              featured
            />
            {later.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                memberName={memberName}
                memberEmail={session.user.email}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarDotsIcon />}
            title={t("upcomingEmpty")}
            description={t("upcomingEmptyHint")}
            action={<FindExpertButton href={expertsUrl} />}
          />
        )}
      </Section>

      <Section
        title={t("pastTitle")}
        actions={
          past.bookings.length > PAST_ON_HOME || past.nextCursor ? (
            <LinkButton
              variant="ghost"
              size="sm"
              href={`${SPACE_BASE}/sessions`}
            >
              {t("viewAll")}
            </LinkButton>
          ) : null
        }
      >
        {past.bookings.length === 0 ? (
          <EmptyState
            icon={<ClockIcon />}
            title={t("pastEmpty")}
            description={t("pastEmptyHint")}
          />
        ) : (
          <div className="grid gap-3">
            {past.bookings.slice(0, PAST_ON_HOME).map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                memberName={memberName}
                memberEmail={session.user.email}
                past
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
