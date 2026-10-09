import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { z } from "zod"
import { PageHeader } from "@eleva/ui/components/page-header"
import { LinkButton } from "@eleva/ui/components/button"
import { getApiBaseUrl } from "@/lib/member-api"
import { parseJoinGrantQuery } from "@/lib/join-grant-query"
import { PublicJoinPageClient } from "./join-client"

export const dynamic = "force-dynamic"

const BookingIdSchema = z.string().uuid()

export default async function PublicJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>
  searchParams: Promise<{ g?: string | string[] }>
}) {
  const [{ bookingId }, query, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("sessions"),
  ])
  if (!BookingIdSchema.safeParse(bookingId).success) notFound()

  const parsed = parseJoinGrantQuery(query.g)
  const backHref = "/home"
  const apiBaseUrl = getApiBaseUrl()

  if (parsed.status === "invalid") {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <PageHeader title={t("join")} description={t("joinInvalidGrant")} />
        <LinkButton href={backHref}>{t("call.back")}</LinkButton>
      </div>
    )
  }

  return (
    <PublicJoinPageClient
      bookingId={bookingId}
      apiBaseUrl={apiBaseUrl}
      backHref={backHref}
      grantFromUrl={parsed.status === "ok" ? parsed.grant : null}
    />
  )
}
