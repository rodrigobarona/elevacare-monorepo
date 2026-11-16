"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { isValidTaxId, normalizeTaxId } from "@eleva/config/tax-id"
import { Button } from "@eleva/ui/components/button"
import { FieldError } from "@eleva/ui/components/field"
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
import { saveNif } from "./actions"

const HINT_KEYS: Record<string, "hintPT" | "hintES" | "hintBR"> = {
  PT: "hintPT",
  ES: "hintES",
  BR: "hintBR",
}

/** The tax number Eleva prints on the service-fee invoices it issues the expert. */
export function NifSection({
  initial,
  country,
}: {
  initial: string
  country: string | null
}) {
  const t = useTranslations("finance.invoicing.nif")
  const [nif, setNif] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [invalid, setInvalid] = useState(false)
  const [isSaving, startSaving] = useTransition()
  const trimmed = nif.trim()
  const hintKey = (country && HINT_KEYS[country.toUpperCase()]) ?? "hint"

  function save() {
    if (trimmed && !isValidTaxId(trimmed, country)) {
      setInvalid(true)
      return
    }
    const next = trimmed ? normalizeTaxId(trimmed, country) : ""
    startSaving(async () => {
      const result = await saveNif({ nif: next || null })
      if (!result.ok) {
        if (result.error === "invalid-tax-id") setInvalid(true)
        else toast.error(t("failed"))
        return
      }
      toast.success(t("saved"))
      setNif(next)
      setSaved(next)
    })
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle>{t("title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("description")}
        </SettingsFieldsetDescription>
        <div className="mt-4 flex max-w-sm flex-col gap-1.5">
          <Label htmlFor="invoicing-nif">{t("label")}</Label>
          <Input
            id="invoicing-nif"
            value={nif}
            onChange={(e) => {
              setNif(e.target.value)
              setInvalid(false)
            }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={32}
            aria-invalid={invalid}
            aria-describedby={
              invalid
                ? "invoicing-nif-hint invoicing-nif-error"
                : "invoicing-nif-hint"
            }
          />
          <p id="invoicing-nif-hint" className="text-sm text-muted-foreground">
            {t(hintKey)}
          </p>
          <FieldError id="invoicing-nif-error">
            {invalid ? t("invalid") : null}
          </FieldError>
        </div>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        <SettingsFieldsetActions>
          <Button
            type="button"
            size="sm"
            isDisabled={trimmed === saved || isSaving}
            onPress={save}
          >
            {isSaving ? t("saving") : t("save")}
          </Button>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
