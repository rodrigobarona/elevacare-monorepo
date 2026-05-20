import { cookies } from "next/headers"
import {
  parseThemeFromCookie,
  resolveThemeClass,
  type ResolvedAppearance,
  type ThemePreference,
} from "@eleva/config/theme"

export async function getServerThemePreference(): Promise<ThemePreference> {
  const cookieStore = await cookies()
  return parseThemeFromCookie(cookieStore.toString())
}

/** Resolved light/dark for SSR `html` class (system → light on server). */
export async function getServerAppearance(): Promise<ResolvedAppearance> {
  const preference = await getServerThemePreference()
  return resolveThemeClass(preference)
}
