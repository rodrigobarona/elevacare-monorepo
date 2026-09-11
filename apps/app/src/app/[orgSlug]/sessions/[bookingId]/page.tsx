import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { Badge } from "@eleva/ui/components/badge"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { getAuthedApiClient, requireMemberOrg } from "@/lib/member-api"
import { eventTitle, formatDateTime, formatMoney } from "@/lib/member-format"
import { SessionActions } from "../../_components/session-actions"
import { IcsDownloadButton } from "./ics-download-button"

export const dynamic = "force-dynamic"

const BOOKING_STATUS_KEYS = [
  "confirmed",
  "rescheduled",
  "cancelled",
  "pending_payment",
  "completed",
  "no_show",
] as const

type BookingStatusKey = (typeof BOOKING_STATUS_KEYS)[number]

function isBookingStatus(value: string): value is BookingStatusKey {
  return (BOOKING_STATUS_KEYS as readonly string[]).includes(value)
}

const MODE_KEYS = ["online", "in_person", "phone"] as const
type ModeKey = (typeof MODE_KEYS)[number]

function isMode(value: string): value is ModeKey {
  return (MODE_KEYS as readonly string[]).includes(value)
}

async function findBooking(
  api: Awaited<ReturnType<typeof getAuthedApiClient>>,
  bookingId: string
) {
  for (const range of ["upcoming", "past"] as const) {
    let cursor: string | undefined
    for (let page = 0; page < 8; page += 1) {
      const result = await api.me.listBookings({ range, cursor })
      const found = result.bookings.find((booking) => booking.id === bookingId)
      if (found) return found
      if (!result.nextCursor) break
      cursor = result.nextCursor
    }
  }
  return null
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; bookingId: string }>
}) {
  const { orgSlug, bookingId } = await params
  const session = await requireMemberOrg(orgSlug)
  const [t, locale, api] = await Promise.all([
    getTranslations("sessions"),
    getLocale(),
    getAuthedApiClient(),
  ])
  const booking = await findBooking(api, bookingId)
  if (!booking) notFound()

  const payments = await api.me.listPayments()
  const payment = payments.payments.find((row) => row.bookingId === booking.id)
  const title = eventTitle(booking.eventType.title, locale)
  const memberName = session.user.displayName ?? session.user.email

  return (
    <div className="space-y-8">
      <AccountPageHeader title={title} description={t("detailTitle")} />

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">{t("expert")}</dt>
          <dd>{booking.expert.displayName}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("when")}</dt>
          <dd>
            {formatDateTime(booking.startsAt, locale, booking.timezone)} –{" "}
            {formatDateTime(booking.endsAt, locale, booking.timezone)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("mode")}</dt>
          <dd>
            {isMode(booking.sessionMode)
              ? t(`modes.${booking.sessionMode}`)
              : booking.sessionMode}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("status")}</dt>
          <dd>
            <Badge variant="secondary">
              {isBookingStatus(booking.status)
                ? t(`statusLabel.${booking.status}`)
                : booking.status}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("price")}</dt>
          <dd>{formatMoney(booking.priceCents, locale, booking.currency)}</dd>
        </div>
        {payment?.receiptUrl ? (
          <div>
            <dt className="text-sm text-muted-foreground">{t("receipt")}</dt>
            <dd>
              <LinkButton
                variant="outline"
                size="sm"
                href={payment.receiptUrl}
                target="_blank"
              >
                {t("receipt")}
              </LinkButton>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button isDisabled aria-label={t("joinSoon")}>
          {t("join")}
        </Button>
        <IcsDownloadButton
          booking={booking}
          memberName={memberName}
          memberEmail={session.user.email}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t("joinSoon")}</p>

      <SessionActions
        orgSlug={orgSlug}
        bookingId={booking.id}
        startsAt={booking.startsAt}
        endsAt={booking.endsAt}
        timezone={booking.timezone}
        status={booking.status}
      />
    </div>
  )
}
