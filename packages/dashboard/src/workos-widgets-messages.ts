import { getDictionary, type LocaleCode } from "@workos-inc/widgets-i18n"

import ptPtMessages from "./workos-widgets-pt-PT.json"

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
