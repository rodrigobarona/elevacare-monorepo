"use client"

import { useEffect, useRef, useActionState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Label } from "@eleva/ui/components/label"
import { Button } from "@eleva/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { locales, localeNames, type Locale } from "@eleva/config/i18n"
import { updateLanguagePreference } from "./actions"

export function LanguagePreference() {
  const t = useTranslations("settings")
  const currentLocale = useLocale()
  const router = useRouter()
  const prevSavedRef = useRef(false)

  const [state, formAction, isPending] = useActionState(
    updateLanguagePreference,
    { ok: true }
  )

  useEffect(() => {
    const justSaved = state.ok && "saved" in state && state.saved === true
    if (justSaved && !prevSavedRef.current) {
      router.refresh()
    }
    prevSavedRef.current = justSaved ?? false
  }, [state, router])

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="locale">{t("profile.language")}</Label>
        <Select name="locale" defaultValue={currentLocale}>
          <SelectTrigger id="locale" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locales.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {localeNames[loc as Locale]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!state.ok && (
        <p className="text-sm text-destructive" role="alert">
          {t("profile.languageError")}
        </p>
      )}

      {state.ok && "saved" in state && state.saved && (
        <p className="text-sm text-muted-foreground">
          {t("profile.languageSaved")}
        </p>
      )}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? t("profile.saving") : t("profile.save")}
      </Button>
    </form>
  )
}
