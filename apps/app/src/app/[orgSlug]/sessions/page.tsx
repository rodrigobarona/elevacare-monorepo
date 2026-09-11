import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { getAuthedApiClient, requireMemberOrg } from "@/lib/member-api"
import { BookingCard } from "../_components/booking-card"

export const dynamic = "force-dynamic"

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await requireMemberOrg(orgSlug)
  const t = await getTranslations("sessions")
  const api = await getAuthedApiClient()
  const [upcoming, past] = await Promise.all([
    api.me.listBookings({ range: "upcoming" }),
    api.me.listBookings({ range: "past" }),
  ])
  const memberName = session.user.displayName ?? session.user.email

  return (
    <div className="space-y-8">
      <AccountPageHeader title={t("title")} description={t("subtitle")} />

      <section className="space-y-4">
        <h2 className="font-medium">{t("upcomingTitle")}</h2>
        {upcoming.bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyUpcoming")}</p>
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
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">{t("pastTitle")}</h2>
        {past.bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyPast")}</p>
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
      </section>
    </div>
  )
}
