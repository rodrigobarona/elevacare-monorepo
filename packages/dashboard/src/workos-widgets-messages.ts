import { getDictionary, type LocaleCode } from "@workos-inc/widgets-i18n"

import ptPtMessages from "./workos-widgets-pt-PT.json"

/**
 * WorkOS maps `pt-PT` to `pt.json`, which is Brazilian Portuguese ("Você", "Sair").
 * Eleva keeps European Portuguese in `workos-widgets-pt-PT.json` and passes it as
 * `initialMessages` so our patched WorkOsLocaleProvider does not overwrite it.
 */
export async function loadWorkOSWidgetMessages(
  locale: LocaleCode
): Promise<Record<string, string>> {
  if (locale === "pt-PT") {
    return ptPtMessages
  }

  return getDictionary(locale)
}

export function getWorkOSWidgetMessagesSync(
  locale: LocaleCode
): Record<string, string> | null {
  if (locale === "pt-PT") {
    return ptPtMessages
  }

  return null
}
