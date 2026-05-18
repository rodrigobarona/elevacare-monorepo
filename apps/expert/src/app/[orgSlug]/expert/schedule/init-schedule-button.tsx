"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import { Card, CardContent } from "@eleva/ui/components/card"
import { CalendarClock } from "lucide-react"
import { initializeScheduleAction } from "./actions"

export function InitScheduleButton({ timezone }: { timezone: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const t = useTranslations("schedule")

  function handleClick() {
    startTransition(async () => {
      const result = await initializeScheduleAction(timezone)
      if (result.ok) {
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <CalendarClock className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">{t("noScheduleTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("noScheduleDescription")}
          </p>
        </div>
        <Button onClick={handleClick} disabled={isPending}>
          {isPending ? t("creating") : t("createSchedule")}
        </Button>
      </CardContent>
    </Card>
  )
}
