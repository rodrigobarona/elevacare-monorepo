import { getRequestConfig } from "next-intl/server"
import { hasLocale } from "next-intl"
import { getDashboardMessages } from "@eleva/dashboard/messages"
import { routing } from "./routing"

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  const [siteMessages, dashboardMessages] = await Promise.all([
    import(`../../messages/${locale}.json`, { with: { type: "json" } }).then(
      (mod) => mod.default as Record<string, unknown>
    ),
    getDashboardMessages(locale),
  ])

  // The avatar menu is shared with the signed-in apps; its copy lives there.
  return {
    locale,
    messages: { ...siteMessages, accountMenu: dashboardMessages.accountMenu },
  }
})
