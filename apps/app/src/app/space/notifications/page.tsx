import { InboxPage } from "@eleva/dashboard"
import { requireMemberSpace } from "@/lib/member-api"

export const dynamic = "force-dynamic"

export default async function MemberInboxPage() {
  const session = await requireMemberSpace()
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
  return <InboxPage apiBaseUrl={apiBaseUrl} orgSlug={session.orgSlug ?? ""} />
}
