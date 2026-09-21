import { InboxPage } from "@eleva/dashboard"
import { requireMemberOrg } from "@/lib/member-api"

export const dynamic = "force-dynamic"

export default async function MemberInboxPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  await requireMemberOrg(orgSlug)
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
  return <InboxPage apiBaseUrl={apiBaseUrl} orgSlug={orgSlug} />
}
