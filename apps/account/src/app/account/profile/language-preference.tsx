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

interface LanguagePreferenceProps {
  preferredLocale: Locale | null
}

export function LanguagePreference({
  preferredLocale,
}: LanguagePreferenceProps) {
  const t = useTranslations("settings")
  const currentLocale = useLocale()
  const selectedLocale = preferredLocale ?? (currentLocale as Locale)
  const router = useRouter()
  const lastRefreshedState = useRef<unknown>(null)

  const [state, formAction, isPending] = useActionState(
    updateLanguagePreference,
    { ok: true }
  )

  useEffect(() => {
    if (
      state.ok &&
      "saved" in state &&
      state.saved &&
      state !== lastRefreshedState.current
    ) {
      lastRefreshedState.current = state
      router.refresh()
    }
  }, [state, router])

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="locale">{t("profile.language")}</Label>
        <Select name="locale" defaultValue={selectedLocale}>
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
