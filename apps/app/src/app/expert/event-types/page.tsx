import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { getExpertProfileByUserId, listExpertEventTypes } from "@eleva/db"
import { AppShell } from "@/components/app-shell"
import { Button } from "@eleva/ui/components/button"
import { Badge } from "@eleva/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { EventTypeActions } from "./event-type-actions"

export const dynamic = "force-dynamic"

type LocalizedText = { en: string; pt?: string; es?: string }

export default async function EventTypesPage() {
  const session = await getSession()
  if (!session) redirect("/signin")
  if (!session.capabilities.includes("events:manage")) redirect("/")

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect("/expert/onboarding")

  const eventTypes = await listExpertEventTypes(profile.orgId, profile.id)
  const t = await getTranslations("eventTypes")

  return (
    <AppShell session={session}>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <Link href="/expert/event-types/new">
            <Button>{t("create")}</Button>
          </Link>
        </header>

        {eventTypes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t("empty")}</p>
              <Link
                href="/expert/event-types/new"
                className="mt-4 inline-block"
              >
                <Button variant="outline">{t("createFirst")}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {eventTypes.map((et) => {
              const etTitle = et.title as LocalizedText
              return (
                <Card key={et.id}>
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{etTitle.en}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        /{profile.username}/{et.slug}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {et.published ? (
                        <Badge>Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                      <EventTypeActions
                        eventTypeId={et.id}
                        published={et.published}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      <span>{et.durationMinutes} min</span>
                      <span>
                        {(et.priceAmount / 100).toFixed(2)}{" "}
                        {et.currency.toUpperCase()}
                      </span>
                      <span className="capitalize">
                        {et.sessionMode.replace("_", " ")}
                      </span>
                      <span>
                        {(et.languages as string[]).join(", ").toUpperCase()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
