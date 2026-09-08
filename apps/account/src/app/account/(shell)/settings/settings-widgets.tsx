"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { authClient } from "@eleva/auth/client"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
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
  const router = useRouter()
  const [name, setName] = useState(displayName)
  const [profilePending, setProfilePending] = useState(false)
  const [languagePending, setLanguagePending] = useState(false)

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfilePending(true)
    const { error } = await authClient.updateUser({ name: name.trim() })
    setProfilePending(false)
    if (error) {
      toast.error(error.message ?? t("profile.profileError"))
      return
    }
    toast.success(t("profile.profileSaved"))
    router.refresh()
  }

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
          <form className="mt-4 space-y-3" onSubmit={onSaveProfile}>
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">
                {t("profile.email")}
              </p>
              <p className="text-sm">{email}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">{t("profile.name")}</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <Button type="submit" size="sm" isDisabled={profilePending}>
              {profilePending ? t("profile.saving") : t("profile.save")}
            </Button>
          </form>
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
