"use client"

import { useTranslations } from "next-intl"
import { UserProfile, UserSecurity, UserSessions } from "@workos-inc/widgets"
import { getSettingsWidgetToken } from "./actions"
import { AvatarUpload } from "./avatar-upload"
import { LanguagePreference } from "./language-preference"

interface SettingsWidgetsProps {
  authToken: string
  avatarUrl: string | null
  displayName: string
  apiBaseUrl: string
}

export function SettingsWidgets({
  authToken,
  avatarUrl,
  displayName,
  apiBaseUrl,
}: SettingsWidgetsProps) {
  const t = useTranslations("settings")

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-lg font-medium">{t("avatar.title")}</h2>
        <AvatarUpload
          currentAvatarUrl={avatarUrl}
          displayName={displayName}
          apiBaseUrl={apiBaseUrl}
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">{t("profile.title")}</h2>
        <UserProfile authToken={authToken} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">{t("language.title")}</h2>
        <LanguagePreference />
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
