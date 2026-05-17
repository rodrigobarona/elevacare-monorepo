import type { Locale } from "@eleva/config/i18n"

export async function getDashboardMessages(
  locale: Locale
): Promise<Record<string, Record<string, string>>> {
  const mod = await import(`../messages/${locale}.json`, {
    with: { type: "json" },
  })
  return mod.default as Record<string, Record<string, string>>
}
