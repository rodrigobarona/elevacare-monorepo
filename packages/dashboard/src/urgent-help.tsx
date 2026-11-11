import { useId, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import {
  URGENT_HELP_LINES,
  URGENT_HELP_NUMBERS,
  type UrgentHelpLine,
} from "@eleva/config/urgent-help"
import { PhoneIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"

/** One rich-text tag per line: `<sns24></sns24>` renders its phone link. */
const PHONE_LINKS = Object.fromEntries(
  URGENT_HELP_LINES.map((line) => [line, () => <PhoneLink line={line} />])
) as Record<UrgentHelpLine, () => ReactNode>

function PhoneLink({ line }: { line: UrgentHelpLine }) {
  const { display, href } = URGENT_HELP_NUMBERS[line]
  return (
    <a
      href={href}
      className="-mx-2 -my-2 inline-block px-2 py-2 font-semibold whitespace-nowrap text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-foreground"
    >
      {display}
    </a>
  )
}

/**
 * Where to turn when something cannot wait for a booked session: 112, and
 * the national lines the reader's language names. Shown wherever members
 * book, wait for or look up a session.
 *
 * Copy lives in the `urgentHelp` messages and names each line with an
 * empty tag (`<emergency></emergency>`, `<sns24></sns24>`); the numbers
 * and their `tel:` links come from `@eleva/config/urgent-help`.
 *
 * `compact` is for use inside the booking form, next to the note members
 * write to their expert.
 */
export function UrgentHelp({
  variant = "full",
  className,
}: {
  variant?: "full" | "compact"
  className?: string
}) {
  const t = useTranslations("urgentHelp")
  const titleId = useId()
  const Title = variant === "full" ? "h2" : "p"

  return (
    <div
      role="note"
      aria-labelledby={titleId}
      data-testid="urgent-help"
      className={cn(
        "flex gap-3 rounded-2xl bg-muted/60 p-4 text-sm leading-relaxed dark:bg-foreground/5",
        className
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-1"
      >
        <PhoneIcon className="size-4" />
      </span>
      <div className="max-w-prose min-w-0 space-y-1 text-pretty">
        <Title
          id={titleId}
          className={cn(
            "font-medium text-foreground",
            variant === "full" && "text-base"
          )}
        >
          {t("title")}
        </Title>
        <p className="text-muted-foreground">{t.rich(variant, PHONE_LINKS)}</p>
        {variant === "full" ? (
          <p className="text-muted-foreground">
            {t.rich("national", PHONE_LINKS)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
