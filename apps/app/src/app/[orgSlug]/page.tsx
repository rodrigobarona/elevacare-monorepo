import { getLocale, getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { resolveGatewayUrl } from "@eleva/config/env"
import { LinkButton } from "@eleva/ui/components/button"
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
  const expertsUrl = `${resolveGatewayUrl()}/${locale === "en" ? "experts" : `${locale}/experts`}`
  const memberName = session.user.displayName ?? session.user.email
  const ts = await getTranslations("sessions")

  return (
    <div className="space-y-8" data-testid="member-space-home">
      <AccountPageHeader
        title={t("welcome", { name: memberName })}
        description={t("subtitle")}
        actions={<FindExpertButton href={expertsUrl} />}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-medium">{t("upcomingTitle")}</h2>
          <LinkButton variant="ghost" size="sm" href={`/${orgSlug}/sessions`}>
            {t("viewAll")}
          </LinkButton>
        </div>
        {upcoming.bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("upcomingEmpty")}</p>
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
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">{t("pastTitle")}</h2>
        {past.bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pastEmpty")}</p>
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
      </section>
    </div>
  )
}
