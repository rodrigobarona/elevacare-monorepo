"use client"

import { useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@eleva/ui/components/button"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import {
  SessionModesField,
  type SessionMode,
} from "../_components/session-modes-field"
import { BlockedByServices, plainList, quotedList } from "./blocked-by-services"
import { savePublicProfile } from "./actions"

const MODE_LABEL_KEYS: Record<string, string> = {
  online: "modeOnline",
  in_person: "modeInPerson",
  phone: "modePhone",
}

const sameModes = (a: string[], b: string[]) =>
  [...a].sort().join(",") === [...b].sort().join(",")

/** How the expert meets members; members can filter experts by it. */
export function SessionModesSection({
  initial,
  servicesHref,
}: {
  initial: string[]
  servicesHref: string
}) {
  const t = useTranslations("publicProfile")
  const tModes = useTranslations("onboarding.profileStep")
  const locale = useLocale()
  const [modes, setModes] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [isSaving, startSaving] = useTransition()
  const [blocked, setBlocked] = useState<string | null>(null)

  const isDirty = !sameModes(modes, saved)

  function save() {
    const next = [...modes]
    startSaving(async () => {
      const result = await savePublicProfile({
        sessionModes: next as SessionMode[],
      })
      if (!result.ok) {
        if (result.error === "mode-in-use") {
          const services = result.services ?? []
          const removed = (result.modes ?? []).map((mode) =>
            tModes(MODE_LABEL_KEYS[mode] ?? "modeOnline")
          )
          setBlocked(
            services.length > 0 && removed.length > 0
              ? t("modes.errors.in-use", {
                  count: services.length,
                  services: quotedList(locale, services),
                  removed: plainList(locale, removed),
                })
              : t("modes.errors.in-use-generic")
          )
          return
        }
        toast.error(result.message ?? t("saveFailed"))
        return
      }
      setBlocked(null)
      toast.success(t("saved"))
      setSaved(next)
    })
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle>{t("modes.title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("modes.description")}
        </SettingsFieldsetDescription>
        <div className="mt-4">
          <SessionModesField
            value={modes}
            onChange={(next) => {
              setModes(next)
              setBlocked(null)
            }}
            hint={t("modes.hint")}
            hideLegend
          />
        </div>
        {blocked ? (
          <BlockedByServices message={blocked} servicesHref={servicesHref} />
        ) : null}
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        {isDirty && modes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("modes.required")}</p>
        ) : null}
        <SettingsFieldsetActions>
          <Button
            type="button"
            size="sm"
            isDisabled={!isDirty || modes.length === 0 || isSaving}
            onPress={save}
          >
            {isSaving ? t("saving") : t("save")}
          </Button>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
