"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetStatus,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
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
    <SettingsFieldset>
      <SettingsFieldsetContent className="flex flex-col items-center text-center">
        <CalendarClock className="mb-4 size-10 text-muted-foreground" />
        <SettingsFieldsetTitle>{t("noScheduleTitle")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("noScheduleDescription")}
        </SettingsFieldsetDescription>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        <SettingsFieldsetStatus />
        <SettingsFieldsetActions>
          <Button size="sm" onClick={handleClick} disabled={isPending}>
            {isPending ? t("creating") : t("createSchedule")}
          </Button>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
