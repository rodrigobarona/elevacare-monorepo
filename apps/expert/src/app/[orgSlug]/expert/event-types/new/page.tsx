import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { guardSession } from "@eleva/auth"
import { getExpertProfileByUserId } from "@eleva/db"
import { EventTypeForm } from "../event-type-form"

export const dynamic = "force-dynamic"

export default async function NewEventTypePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await guardSession()
  if (!session.capabilities.includes("events:manage")) redirect(`/${orgSlug}`)

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect(`/${orgSlug}/expert/onboarding`)

  const t = await getTranslations("eventTypes")

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AccountPageHeader
        title={t("createTitle")}
        description={t("createDescription")}
      />
      <EventTypeForm mode="create" />
    </div>
  )
}
