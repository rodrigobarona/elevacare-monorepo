import { getLocale, getTranslations } from "next-intl/server"
import { LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader, Section } from "@eleva/ui/components/page-header"
import { marketplaceExpertsUrl } from "@/lib/experts-url"
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
  const ts = await getTranslations("sessions")

  return (
    <div className="space-y-8" data-testid="member-space-home">
      <PageHeader
        title={t("welcome", { name: memberName })}
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
        {upcoming.bookings.length === 0 ? (
          <EmptyState
            title={t("upcomingEmpty")}
            action={<FindExpertButton href={expertsUrl} />}
          />
        ) : (
          <div className="grid gap-4">
            {upcoming.bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                orgSlug={orgSlug}
                memberName={memberName}
                memberEmail={session.user.email}
              />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{ts("joinSoon")}</p>
      </Section>

      <Section title={t("pastTitle")}>
        {past.bookings.length === 0 ? (
          <EmptyState title={t("pastEmpty")} />
        ) : (
          <div className="grid gap-4">
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
