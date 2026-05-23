"use client"

import { useEffect, useRef, useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { locales, localeNames, type Locale } from "@eleva/config/i18n"
import { toast } from "sonner"
import { updateLanguagePreference } from "./actions"

export const LANGUAGE_PREFERENCE_FORM_ID = "language-preference-form"

interface LanguagePreferenceProps {
  preferredLocale: Locale | null
  onPendingChange?: (pending: boolean) => void
}

export function LanguagePreference({
  preferredLocale,
  onPendingChange,
}: LanguagePreferenceProps) {
  const t = useTranslations("settings")
  const currentLocale = useLocale()
  const selectedLocale = preferredLocale ?? (currentLocale as Locale)
  const [locale, setLocale] = useState<Locale>(selectedLocale)
  const router = useRouter()
  const lastRefreshedState = useRef<unknown>(null)

  useEffect(() => {
    setLocale(selectedLocale)
  }, [selectedLocale])

  const [state, formAction, isPending] = useActionState(
    updateLanguagePreference,
    { ok: true }
  )

  useEffect(() => {
    onPendingChange?.(isPending)
  }, [isPending, onPendingChange])

  useEffect(() => {
    if (state === lastRefreshedState.current) return

    if (!state.ok) {
      lastRefreshedState.current = state
      toast.error(t("profile.languageError"))
      return
    }

    if ("saved" in state && state.saved) {
      lastRefreshedState.current = state
      toast.success(t("profile.languageSaved"))
      router.refresh()
    }
  }, [state, router, t])

  return (
    <form
      id={LANGUAGE_PREFERENCE_FORM_ID}
      action={formAction}
      className="flex flex-col items-end gap-2"
    >
      <input type="hidden" name="locale" value={locale} />
      <Select
        value={locale}
        onValueChange={(value) => setLocale(value as Locale)}
      >
        <SelectTrigger
          id="locale"
          className="w-44"
          aria-label={t("language.title")}
        >
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
    </form>
  )
}
