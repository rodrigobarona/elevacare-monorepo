import { Fragment, type ReactNode } from "react"
import { Link } from "react-email"
import {
  URGENT_HELP_NUMBERS,
  isUrgentHelpLine,
} from "@eleva/config/urgent-help"
import { EmailBodyText } from "./email-heading"
import { getEmailTranslations, type EmailLocale } from "../i18n"

/** `emergency`: the 112 line only. `full`: 112 and the national lines. */
export type UrgentHelpDetail = "emergency" | "full"

/**
 * Member emails about a session: where to turn when something cannot
 * wait. Numbers and their `tel:` links come from
 * `@eleva/config/urgent-help`; the copy names each line as `{key}`.
 */
export function UrgentHelpNote({
  locale,
  detail,
}: {
  locale: EmailLocale
  detail: UrgentHelpDetail
}) {
  const t = getEmailTranslations(locale)
  return (
    <>
      <EmailBodyText className="mt-[24px] text-[14px] leading-[22px]">
        <span className="text-fg-2 font-semibold">
          {t.booking.urgentHelpTitle}
        </span>{" "}
        {withPhoneLinks(t.booking.urgentHelp)}
      </EmailBodyText>
      {detail === "full" ? (
        <EmailBodyText className="mt-[8px] text-[14px] leading-[22px]">
          {withPhoneLinks(t.booking.urgentHelpNational)}
        </EmailBodyText>
      ) : null}
    </>
  )
}

/** Replace each `{line}` with that line's number as a `tel:` link. */
function withPhoneLinks(copy: string): ReactNode[] {
  return copy.split(/(\{[a-z0-9]+\})/i).map((part, index) => {
    const key = part.startsWith("{") ? part.slice(1, -1) : ""
    if (!isUrgentHelpLine(key)) return <Fragment key={index}>{part}</Fragment>
    const { display, href } = URGENT_HELP_NUMBERS[key]
    return (
      <Link
        key={index}
        href={href}
        className="text-fg-2 font-semibold whitespace-nowrap underline"
      >
        {display}
      </Link>
    )
  })
}
