"use client"

import { useTranslations } from "next-intl"
import { UserProfile } from "@workos-inc/widgets"
import { UserSecurity } from "@workos-inc/widgets"
import { UserSessions } from "@workos-inc/widgets"
import { getSettingsWidgetToken } from "./actions"

interface SettingsWidgetsProps {
  authToken: string
}

export function SettingsWidgets({ authToken }: SettingsWidgetsProps) {
  const t = useTranslations("settings")

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-lg font-medium">{t("profile.title")}</h2>
        <UserProfile authToken={authToken} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">{t("security.title")}</h2>
        <UserSecurity authToken={authToken} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">{t("sessions.title")}</h2>
        <UserSessions authToken={getSettingsWidgetToken} />
      </section>
    </div>
  )
}
