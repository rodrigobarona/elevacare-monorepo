import { useId, type ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { urgentHelpNumbers } from "@eleva/config/urgent-help"
import { PhoneIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"

/**
 * Where to turn when something cannot wait for a booked session: 112, and
 * the national line the reader's language names. Shown wherever members
 * book, wait for or look up a session. Copy lives in the `urgentHelp`
 * messages; the numbers come from `@eleva/config/urgent-help`.
 *
 * `compact` keeps the title and the 112 line, for use inside a form.
 */
export function UrgentHelp({
  variant = "full",
  className,
}: {
  variant?: "full" | "compact"
  className?: string
}) {
  const t = useTranslations("urgentHelp")
  const locale = useLocale()
  const titleId = useId()
  const { emergency, national } = urgentHelpNumbers(locale)

  return (
    <div
      role="note"
      aria-labelledby={titleId}
      data-testid="urgent-help"
      className={cn(
        "flex gap-3 rounded-2xl bg-muted/60 p-4 text-sm leading-relaxed",
        className
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-1"
      >
        <PhoneIcon className="size-4" />
      </span>
      <div className="min-w-0 space-y-1 text-pretty">
        <p id={titleId} className="font-medium text-foreground">
          {t("title")}
        </p>
        <p className="text-muted-foreground">
          {t.rich("emergency", {
            number: emergency.display,
            call: (chunks) => (
              <PhoneLink href={emergency.href}>{chunks}</PhoneLink>
            ),
          })}
        </p>
        {variant === "full" ? (
          <>
            <p className="text-muted-foreground">
              {t("bookedAhead", { number: emergency.display })}
            </p>
            {national ? (
              <p className="text-muted-foreground">
                {t.rich("national", {
                  number: national.display,
                  call: (chunks) => (
                    <PhoneLink href={national.href}>{chunks}</PhoneLink>
                  ),
                })}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

function PhoneLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="font-semibold whitespace-nowrap text-foreground underline decoration-primary/60 underline-offset-4 hover:decoration-primary"
    >
      {children}
    </a>
  )
}
