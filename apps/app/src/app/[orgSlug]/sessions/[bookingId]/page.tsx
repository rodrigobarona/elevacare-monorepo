import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ApiClientError, type ExpertInvoiceStatus } from "@eleva/api-client"
import { VideoCameraIcon } from "@eleva/icons"
import { PageHeader } from "@eleva/ui/components/page-header"
import { LinkButton } from "@eleva/ui/components/button"
import { findMemberBooking } from "@/lib/find-member-booking"
import { getAuthedApiClient, requireMemberOrg } from "@/lib/member-api"
import { eventTitle, formatMoney } from "@/lib/member-format"
import {
  isAwaitingConfirmation,
  isBookingStatus,
  isSessionMode,
} from "@/lib/booking-status"
import { JoinCta } from "@eleva/video/join-cta"
import { DateTile } from "@eleva/ui/components/date-tile"
import { bookingDateParts } from "@eleva/ui/lib/booking/date-parts"
import { StatusPill } from "../../_components/booking-visuals"
import { SessionActions } from "../../_components/session-actions"
import { IcsDownloadButton } from "./ics-download-button"

export const dynamic = "force-dynamic"

function invoiceStatusKey(status: ExpertInvoiceStatus) {
  switch (status) {
    case "pending":
    case "issued":
    case "failed":
    case "manual_pending":
    case "manual_issued":
      return `invoiceStatus.${status}` as const
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium sm:text-right">{children}</dd>
    </div>
  )
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
  const booking = await findMemberBooking(api, bookingId)
  if (!booking) notFound()

  const [payments, quote] = await Promise.all([
    api.me.listPayments({ bookingId: booking.id }),
    api.me.cancellationQuote(booking.id).catch((err: unknown) => {
      if (err instanceof ApiClientError && err.status === 409) return null
      throw err
    }),
  ])
  const payment = payments.payments.find((row) => row.bookingId === booking.id)
  const awaiting = isAwaitingConfirmation(booking.status)
  const title = eventTitle(booking.eventType.title, locale)
  const memberName = session.user.displayName ?? session.user.email
  const status = isBookingStatus(booking.status) ? booking.status : null
  const parts = bookingDateParts(
    booking.startsAt,
    booking.endsAt,
    locale,
    booking.timezone
  )

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("detailTitle")}
        title={title}
        description={t("withExpert", { name: booking.expert.displayName })}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-1">
          <div className="flex items-center gap-5 p-6 sm:p-8">
            <DateTile
              month={parts.month}
              day={parts.day}
              weekday={parts.weekday}
              large
            />
            <div className="min-w-0 space-y-1">
              <p className="font-display text-2xl leading-snug font-medium tracking-tight first-letter:uppercase">
                {parts.longDate}
              </p>
              <p className="text-muted-foreground tabular-nums">
                {parts.timeRange}
                <span aria-hidden> · </span>
                {booking.timezone}
              </p>
            </div>
          </div>

          <dl className="divide-y border-t px-6 sm:px-8">
            <DetailRow label={t("expert")}>
              {booking.expert.displayName}
            </DetailRow>
            <DetailRow label={t("mode")}>
              {isSessionMode(booking.sessionMode)
                ? t(`modes.${booking.sessionMode}`)
                : booking.sessionMode}
            </DetailRow>
            <DetailRow label={t("status")}>
              <StatusPill status={status}>
                {status ? t(`statusLabel.${status}`) : booking.status}
              </StatusPill>
            </DetailRow>
            <DetailRow label={t("price")}>
              <span className="tabular-nums">
                {formatMoney(booking.priceCents, locale, booking.currency)}
              </span>
            </DetailRow>
            {payment?.receiptUrl ? (
              <DetailRow label={t("receipt")}>
                <LinkButton
                  variant="link"
                  size="sm"
                  href={payment.receiptUrl}
                  target="_blank"
                  className="h-auto p-0"
                >
                  {t("viewReceipt")}
                </LinkButton>
              </DetailRow>
            ) : null}
            {payment?.invoice ? (
              <DetailRow label={t("invoice")}>
                <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <StatusPill status={null}>
                    {t(invoiceStatusKey(payment.invoice.status))}
                  </StatusPill>
                  {payment.invoice.number ? (
                    <span className="font-normal text-muted-foreground">
                      {t("invoiceNumber", { number: payment.invoice.number })}
                    </span>
                  ) : null}
                </span>
              </DetailRow>
            ) : null}
          </dl>

          <div className="space-y-3 border-t bg-sand-50/70 px-6 py-5 sm:px-8 dark:bg-muted/40">
            <div className="flex flex-wrap gap-2">
              {awaiting ? null : (
                <JoinCta
                  href={`/${orgSlug}/sessions/${bookingId}/join`}
                  sessionMode={booking.sessionMode}
                  status={booking.status}
                  startsAt={booking.startsAt}
                  endsAt={booking.endsAt}
                  joinLabel={t("join")}
                  joinSoonLabel={t("joinSoon")}
                  icon={<VideoCameraIcon className="size-4" />}
                />
              )}
              <IcsDownloadButton
                booking={booking}
                memberName={memberName}
                memberEmail={session.user.email}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {awaiting ? t("awaitingConfirmationHint") : t("joinSoon")}
            </p>
          </div>
        </section>

        <aside className="space-y-3 rounded-3xl border bg-card p-6 text-card-foreground shadow-1">
          <h2 className="font-display text-lg font-medium tracking-tight">
            {t("manageTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("manageHint")}</p>
          <SessionActions
            orgSlug={orgSlug}
            bookingId={booking.id}
            startsAt={booking.startsAt}
            endsAt={booking.endsAt}
            timezone={booking.timezone}
            locale={locale}
            quote={quote}
          />
        </aside>
      </div>
    </div>
  )
}
