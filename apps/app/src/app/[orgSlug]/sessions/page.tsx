import { getLocale, getTranslations } from "next-intl/server"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader, Section } from "@eleva/ui/components/page-header"
import { marketplaceExpertsUrl } from "@/lib/experts-url"
import { getAuthedApiClient, requireMemberOrg } from "@/lib/member-api"
import { BookingCard, FindExpertButton } from "../_components/booking-card"

export const dynamic = "force-dynamic"

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await requireMemberOrg(orgSlug)
  const [t, locale, api] = await Promise.all([
    getTranslations("sessions"),
    getLocale(),
    getAuthedApiClient(),
  ])
  const [upcoming, past] = await Promise.all([
    api.me.listBookings({ range: "upcoming" }),
    api.me.listBookings({ range: "past" }),
  ])
  const memberName = session.user.displayName ?? session.user.email

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Section title={t("upcomingTitle")}>
        {upcoming.bookings.length === 0 ? (
          <EmptyState
            title={t("emptyUpcoming")}
            action={<FindExpertButton href={marketplaceExpertsUrl(locale)} />}
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
      </Section>

      <Section title={t("pastTitle")}>
        {past.bookings.length === 0 ? (
          <EmptyState title={t("emptyPast")} />
        ) : (
          <div className="grid gap-4">
            {past.bookings.map((booking) => (
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
