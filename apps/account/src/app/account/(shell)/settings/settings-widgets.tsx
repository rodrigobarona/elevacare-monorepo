"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
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
import { AvatarUpload } from "./avatar-upload"
import {
  LanguagePreference,
  LANGUAGE_PREFERENCE_FORM_ID,
} from "./language-preference"
import { SettingsSecurity } from "./settings-security"
import type { Locale } from "@eleva/config/i18n"

interface SettingsWidgetsProps {
  avatarUrl: string | null
  displayName: string
  email: string
  apiBaseUrl: string
  preferredLocale: Locale | null
}

export function SettingsWidgets({
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
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("profile.email")}</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("profile.name")}</dt>
              <dd>{displayName}</dd>
            </div>
          </dl>
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
              isDisabled={languagePending}
            >
              {languagePending ? t("profile.saving") : t("profile.save")}
            </Button>
          </SettingsFieldsetActions>
        </SettingsFieldsetFooter>
      </SettingsFieldset>

      <SettingsSecurity />
    </div>
  )
}
