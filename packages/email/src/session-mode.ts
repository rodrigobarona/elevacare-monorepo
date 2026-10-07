import { getEmailTranslations, type EmailLocale } from "./i18n"

export type SessionMode = "online" | "in_person" | "phone"

export function formatSessionMode(
  sessionMode: string,
  locale: EmailLocale
): string {
  const t = getEmailTranslations(locale)
  if (
    sessionMode === "online" ||
    sessionMode === "in_person" ||
    sessionMode === "phone"
  ) {
    return t.modes[sessionMode]
  }
  return sessionMode
}
