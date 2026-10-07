import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { JoinClient } from "./join-client"

export const dynamic = "force-dynamic"

export default async function ExpertJoinPage({
  params,
}: {
  params: Promise<{ orgSlug: string; bookingId: string }>
}) {
  const { orgSlug, bookingId } = await params
  await loadExpertWorkspace(orgSlug, "events:manage")
  const t = await getTranslations("sessions")
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
  const backHref = `/${orgSlug}/calendar`

  return (
    <div className="space-y-6">
      <PageHeader title={t("join")} />
      <JoinClient
        bookingId={bookingId}
        apiBaseUrl={apiBaseUrl}
        backHref={backHref}
      />
    </div>
  )
}
