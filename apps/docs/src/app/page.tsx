import { defaultLocale } from "@eleva/config/i18n"
import { redirect } from "next/navigation"

export default function DocsRootPage() {
  redirect(`/${defaultLocale}`)
}
