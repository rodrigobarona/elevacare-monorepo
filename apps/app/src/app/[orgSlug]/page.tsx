import { getLocale, getTranslations } from "next-intl/server"
import { CalendarDotsIcon, ClockIcon } from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader, Section } from "@eleva/ui/components/page-header"
import { marketplaceExpertsUrl } from "@eleva/config/env"
import { getAuthedApiClient, requireMemberOrg } from "@/lib/member-api"
import { BookingCard, FindExpertButton } from "./_components/booking-card"

export const dynamic = "force-dynamic"

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await requireMemberOrg(orgSlug)
  const [t, ts, locale, api] = await Promise.all([
    getTranslations("home"),
    getTranslations("sessions"),
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
        eyebrow={t("eyebrow")}
        title={firstName ? t("welcome", { name: firstName }) : t("welcomeBack")}
        description={t("subtitle")}
        actions={<FindExpertButton href={expertsUrl} />}
      />

      <Section
        title={t("upcomingTitle")}
        actions={
          <LinkButton variant="ghost" size="sm" href={`/${orgSlug}/sessions`}>
            {t("viewAll")}
          </LinkButton>
        }
      >
        {next ? (
          <div className="grid gap-3">
            <BookingCard
              booking={next}
              orgSlug={orgSlug}
              memberName={memberName}
              memberEmail={session.user.email}
              featured
            />
            {later.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                orgSlug={orgSlug}
                memberName={memberName}
                memberEmail={session.user.email}
              />
            ))}
            <p className="text-xs text-muted-foreground">{ts("joinSoon")}</p>
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

      <Section title={t("pastTitle")}>
        {past.bookings.length === 0 ? (
          <EmptyState
            icon={<ClockIcon />}
            title={t("pastEmpty")}
            description={t("pastEmptyHint")}
          />
        ) : (
          <div className="grid gap-3">
            {past.bookings.slice(0, 5).map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                orgSlug={orgSlug}
                memberName={memberName}
                memberEmail={session.user.email}
                showJoin={false}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
