import { getTranslations } from "next-intl/server"
import {
  ArrowRightIcon,
  ClockIcon,
  ShieldCheckIcon,
  WarningIcon,
} from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import type { LicenceVerificationState } from "@/lib/licence-verification"

const ICONS = {
  pending: ClockIcon,
  needs_changes: WarningIcon,
  rejected: WarningIcon,
  unsubmitted: ShieldCheckIcon,
} as const

/** Dashboard prompt until staff verify the expert's licence. */
export async function LicenceVerificationNotice({
  state,
  href,
}: {
  state: LicenceVerificationState | null
  href: string
}) {
  if (!state || state === "verified") return null
  const t = await getTranslations("licence.notice")
  const Icon = ICONS[state]

  return (
    <section
      aria-labelledby="licence-notice-title"
      data-testid="licence-notice"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-1 sm:flex-row sm:items-center"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon weight="duotone" className="size-6" />
      </span>
      <div className="flex-1 space-y-0.5">
        <h2 id="licence-notice-title" className="font-medium text-pretty">
          {t(`${state}.title`)}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {t(`${state}.body`)}
        </p>
      </div>
      <LinkButton
        href={href}
        variant={state === "pending" ? "outline" : "default"}
        className="self-start sm:self-center"
      >
        {t(`${state}.cta`)}
        <ArrowRightIcon data-icon="inline-end" />
      </LinkButton>
    </section>
  )
}
