import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { z } from "zod"
import { PageHeader } from "@eleva/ui/components/page-header"
import { LinkButton } from "@eleva/ui/components/button"
import { getApiBaseUrl } from "@/lib/member-api"
import { JoinClient } from "./join-client"

export const dynamic = "force-dynamic"

const BookingIdSchema = z.string().uuid()

export default async function PublicJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>
  searchParams: Promise<{ g?: string }>
}) {
  const [{ bookingId }, query, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("sessions"),
  ])
  if (!BookingIdSchema.safeParse(bookingId).success) notFound()

  const grant = query.g?.trim()
  const backHref = "/home"
  const apiBaseUrl = getApiBaseUrl()

  if (!grant) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <PageHeader title={t("join")} description={t("joinMissingGrant")} />
        <LinkButton href={backHref}>{t("call.back")}</LinkButton>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-12">
      <PageHeader title={t("join")} />
      <JoinClient
        bookingId={bookingId}
        apiBaseUrl={apiBaseUrl}
        backHref={backHref}
        grant={grant}
      />
    </div>
  )
}
