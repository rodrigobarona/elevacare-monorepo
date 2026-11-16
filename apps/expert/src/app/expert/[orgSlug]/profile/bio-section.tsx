"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { localeNames, locales, type Locale } from "@eleva/config"
import {
  LocalizedRichTextField,
  type LocalizedRichTextFieldValue,
} from "@eleva/editor/localized-rich-text-field"
import { toPlainTextFromNodes } from "@eleva/editor/types"
import { Button } from "@eleva/ui/components/button"
import { Label } from "@eleva/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { editorAssistAction } from "@/lib/editor-assist-action"
import { useRichTextEditorLabels } from "@/lib/use-rich-text-editor-labels"
import { useProfileSave, type PublicProfilePatch } from "./use-profile-save"

function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (locales as readonly string[]).includes(value)
  )
}

/** Drops empty tabs; `null` clears the bio, `"missing-source"` blocks saving. */
function toBioPatch(
  sourceLocale: Locale,
  value: LocalizedRichTextFieldValue
): PublicProfilePatch["bioRich"] | "missing-source" {
  const filled: LocalizedRichTextFieldValue = {}
  for (const locale of locales) {
    const entry = value[locale]
    if (entry && toPlainTextFromNodes(entry.json).length > 0) {
      filled[locale] = entry
    }
  }
  if (Object.keys(filled).length === 0) return null
  if (!filled[sourceLocale]) return "missing-source"
  return { sourceLocale, locales: filled }
}

export function BioSection({
  profileId,
  initialSourceLocale,
  initialValue,
}: {
  profileId: string
  initialSourceLocale: Locale
  initialValue: LocalizedRichTextFieldValue
}) {
  const t = useTranslations("publicProfile.bio")
  const tProfile = useTranslations("publicProfile")
  const [sourceLocale, setSourceLocale] = useState(initialSourceLocale)
  const [value, setValue] = useState(initialValue)
  const [isDirty, setIsDirty] = useState(false)
  const { isSaving, save } = useProfileSave()
  const editorLabels = useRichTextEditorLabels(t("placeholder"))

  async function assist(
    input: Parameters<typeof editorAssistAction>[0]
  ): Promise<string> {
    const result = await editorAssistAction(input)
    if (!result.ok) throw new Error(result.message ?? result.error)
    return result.text
  }

  function handleSave() {
    const bioRich = toBioPatch(sourceLocale, value)
    if (bioRich === "missing-source") {
      toast.error(t("sourceEmpty"))
      return
    }
    save(
      { bioRich },
      {
        success: bioRich === null ? t("cleared") : undefined,
        onSaved: () => setIsDirty(false),
      }
    )
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle>{t("title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("description")}
        </SettingsFieldsetDescription>

        <div className="mt-4 rounded-2xl bg-muted/60 p-4 text-sm">
          <p className="font-medium">{t("guideTitle")}</p>
          <ol className="mt-2 grid list-decimal gap-1 ps-5 text-muted-foreground sm:grid-cols-2">
            {(t.raw("guide") as string[]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <p className="mt-3 text-muted-foreground">{t("guideTip")}</p>
        </div>

        <div className="mt-5 space-y-4">
          <Select
            className="max-w-xs"
            selectedKey={sourceLocale}
            isDisabled={isSaving}
            onSelectionChange={(key) => {
              if (!isLocale(key)) return
              setSourceLocale(key)
              setIsDirty(true)
            }}
          >
            <Label>{t("writeIn")}</Label>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locales.map((locale) => (
                <SelectItem key={locale} id={locale}>
                  {localeNames[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <LocalizedRichTextField
            value={value}
            sourceLocale={sourceLocale}
            isDisabled={isSaving}
            onChange={(next) => {
              setValue(next.locales)
              setIsDirty(true)
            }}
            labels={{
              localeNames: localeNames,
              sourceBadge: t("localeSource"),
              aiDraftBadge: t("localeAiDraft"),
              translateFrom: (language) => t("translateFrom", { language }),
              translating: t("translating"),
              translateFailed: t("translateFailed"),
              sourceEmpty: t("sourceEmpty"),
            }}
            editorLabels={editorLabels}
            ai={{
              enabled: true,
              context: "marketing",
              onAssist: (command, text, locale) =>
                assist({
                  command,
                  text,
                  sourceLocale: isLocale(locale) ? locale : sourceLocale,
                  resource: "expert_profile",
                  resourceId: profileId,
                }),
            }}
            onTranslate={({ text, sourceLocale: from, targetLocale }) =>
              assist({
                command: "translate",
                text,
                sourceLocale: from,
                targetLocale,
                resource: "expert_profile",
                resourceId: profileId,
              })
            }
          />
        </div>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        <SettingsFieldsetActions>
          <Button
            type="button"
            size="sm"
            isDisabled={!isDirty || isSaving}
            onPress={handleSave}
          >
            {isSaving ? tProfile("saving") : tProfile("save")}
          </Button>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
