"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { UserProfile, UserSecurity, UserSessions } from "@workos-inc/widgets"
import { Button } from "@eleva/ui/components/button"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetAsideSlot,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetStatus,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { ElevaWidgetsProvider } from "@/components/workos-widgets-provider"
import { AvatarUpload } from "./avatar-upload"
import {
  LanguagePreference,
  LANGUAGE_PREFERENCE_FORM_ID,
} from "./language-preference"
import type { Locale } from "@eleva/config/i18n"

interface SettingsWidgetsProps {
  locale: string
  authToken: string
  workosSessionId: string
  avatarUrl: string | null
  displayName: string
  email: string
  apiBaseUrl: string
  preferredLocale: Locale | null
}

export function SettingsWidgets({
  locale,
  authToken,
  workosSessionId,
  avatarUrl,
  displayName,
  email,
  apiBaseUrl,
  preferredLocale,
}: SettingsWidgetsProps) {
  const t = useTranslations("settings")
  const [languagePending, setLanguagePending] = useState(false)

  return (
    <div className="space-y-6">
      <AvatarUpload
        currentAvatarUrl={avatarUrl}
        displayName={displayName}
        email={email}
        apiBaseUrl={apiBaseUrl}
      />

      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("profile.title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("profile.description")}
          </SettingsFieldsetDescription>
          <div className="mt-4">
            <ElevaWidgetsProvider locale={locale}>
              <UserProfile authToken={authToken} />
            </ElevaWidgetsProvider>
          </div>
        </SettingsFieldsetContent>
        <SettingsFieldsetFooter>
          <SettingsFieldsetStatus>
            {t("profile.footerHint")}
          </SettingsFieldsetStatus>
        </SettingsFieldsetFooter>
      </SettingsFieldset>

      <SettingsFieldset>
        <SettingsFieldsetContent layout="aside">
          <SettingsFieldsetAsideSlot>
            <LanguagePreference
              preferredLocale={preferredLocale}
              onPendingChange={setLanguagePending}
            />
          </SettingsFieldsetAsideSlot>
          <SettingsFieldsetTitle>{t("language.title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("language.description")}
          </SettingsFieldsetDescription>
        </SettingsFieldsetContent>
        <SettingsFieldsetFooter>
          <SettingsFieldsetStatus>
            {t("language.footerHint")}
          </SettingsFieldsetStatus>
          <SettingsFieldsetActions>
            <Button
              type="submit"
              form={LANGUAGE_PREFERENCE_FORM_ID}
              size="sm"
              disabled={languagePending}
            >
              {languagePending ? t("profile.saving") : t("profile.save")}
            </Button>
          </SettingsFieldsetActions>
        </SettingsFieldsetFooter>
      </SettingsFieldset>

      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("security.title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("security.description")}
          </SettingsFieldsetDescription>
          <div className="mt-4">
            <ElevaWidgetsProvider locale={locale}>
              <UserSecurity authToken={authToken} />
            </ElevaWidgetsProvider>
          </div>
        </SettingsFieldsetContent>
      </SettingsFieldset>

      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("sessions.title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("sessions.description")}
          </SettingsFieldsetDescription>
          <div className="mt-4">
            <ElevaWidgetsProvider locale={locale}>
              <UserSessions
                authToken={authToken}
                currentSessionId={workosSessionId}
              />
            </ElevaWidgetsProvider>
          </div>
        </SettingsFieldsetContent>
        <SettingsFieldsetFooter>
          <SettingsFieldsetStatus>
            {t("sessions.footerHint")}
          </SettingsFieldsetStatus>
        </SettingsFieldsetFooter>
      </SettingsFieldset>
    </div>
  )
}
