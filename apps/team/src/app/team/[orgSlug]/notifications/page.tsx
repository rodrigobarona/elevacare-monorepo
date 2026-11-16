import { InboxPage } from "@eleva/dashboard"

export const dynamic = "force-dynamic"

export default async function TeamInboxPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
  return <InboxPage apiBaseUrl={apiBaseUrl} orgSlug={orgSlug} />
}
