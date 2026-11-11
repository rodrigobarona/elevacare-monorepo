import { urgentHelpNumbers } from "@eleva/config/urgent-help"
import { EmailBodyText } from "./email-heading"
import { getEmailTranslations, type EmailLocale } from "../i18n"

/**
 * Member emails about an upcoming session: where to turn when something
 * cannot wait. Numbers come from `@eleva/config/urgent-help`.
 */
export function UrgentHelpNote({ locale }: { locale: EmailLocale }) {
  const t = getEmailTranslations(locale)
  const { emergency, national } = urgentHelpNumbers(locale)
  const nationalLine =
    national && t.booking.urgentHelpNational
      ? t.booking.urgentHelpNational(national.display)
      : null
  return (
    <EmailBodyText className="mt-[24px] text-[13px] leading-[20px]">
      {t.booking.urgentHelp(emergency.display)}
      {nationalLine ? ` ${nationalLine}` : null}
    </EmailBodyText>
  )
}
