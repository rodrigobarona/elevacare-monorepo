import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { getPersonalApiClient } from "@/lib/personal-api"
import { NotificationSettings } from "./notification-settings"

export const dynamic = "force-dynamic"

export default async function NotificationsPage() {
  const [t, api] = await Promise.all([
    getTranslations("notificationSettings"),
    getPersonalApiClient(),
  ])
  const profile = await api.me.get()

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <NotificationSettings preferences={profile.preferences} />
    </div>
  )
}
