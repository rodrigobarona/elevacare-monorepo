"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { useProfileSave } from "./use-profile-save"

const HEADLINE_MAX = 120

export function BasicsSection({
  initialDisplayName,
  initialHeadline,
}: {
  initialDisplayName: string
  initialHeadline: string
}) {
  const t = useTranslations("publicProfile")
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [headline, setHeadline] = useState(initialHeadline)
  const [saved, setSaved] = useState({
    displayName: initialDisplayName,
    headline: initialHeadline,
  })
  const { isSaving, save } = useProfileSave()

  const trimmedName = displayName.trim()
  const trimmedHeadline = headline.trim()
  const isDirty =
    trimmedName !== saved.displayName || trimmedHeadline !== saved.headline

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle>{t("basics.title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("basics.description")}
        </SettingsFieldsetDescription>
        <div className="mt-4 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="profile-display-name">
              {t("basics.displayName")}
            </Label>
            <Input
              id="profile-display-name"
              value={displayName}
              maxLength={80}
              onChange={(event) => setDisplayName(event.target.value)}
              aria-describedby="profile-display-name-hint"
            />
            <p
              id="profile-display-name-hint"
              className="text-sm text-muted-foreground"
            >
              {t("basics.displayNameHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-headline">{t("basics.headline")}</Label>
            <Input
              id="profile-headline"
              value={headline}
              maxLength={HEADLINE_MAX}
              placeholder={t("basics.headlinePlaceholder")}
              onChange={(event) => setHeadline(event.target.value)}
              aria-describedby="profile-headline-hint"
            />
            <p
              id="profile-headline-hint"
              className="flex justify-between gap-4 text-sm text-muted-foreground"
            >
              <span>{t("basics.headlineHint")}</span>
              <span aria-hidden>
                {headline.length}/{HEADLINE_MAX}
              </span>
            </p>
          </div>
        </div>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        <SettingsFieldsetActions>
          <Button
            type="button"
            size="sm"
            isDisabled={!isDirty || !trimmedName || isSaving}
            onPress={() =>
              save(
                {
                  displayName: trimmedName,
                  headline: trimmedHeadline || null,
                },
                {
                  onSaved: () =>
                    setSaved({
                      displayName: trimmedName,
                      headline: trimmedHeadline,
                    }),
                }
              )
            }
          >
            {isSaving ? t("saving") : t("save")}
          </Button>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
