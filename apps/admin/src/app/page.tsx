import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { ShieldIcon } from "@eleva/icons"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"

export default async function AdminDashboardPage() {
  const [session, t] = await Promise.all([
    getSession(),
    getTranslations("dashboard"),
  ])

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("welcome")}
        description={t("subtitle")}
      />
      <EmptyState
        icon={<ShieldIcon />}
        title={t("emptyTitle")}
        description={t("emptyBody")}
      />
      <p className="text-sm text-muted-foreground">
        {t("signedInAs", { email: session?.user.email ?? "" })}
      </p>
    </div>
  )
}
