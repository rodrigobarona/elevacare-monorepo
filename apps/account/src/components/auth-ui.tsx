"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { ArrowSquareOutIcon, PaperPlaneTiltIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { cn } from "@eleva/ui/lib/utils"

const RESEND_COOLDOWN_S = 30

/** Wraps one step of an auth flow so each step animates in on mount. */
export function AuthStep({
  children,
  className,
  ...props
}: {
  children: ReactNode
  className?: string
  "data-testid"?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function AuthHeading({
  title,
  description,
  icon,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {icon ? (
        <span className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-2 ring-6 ring-teal-50 motion-safe:animate-in motion-safe:duration-500 motion-safe:zoom-in-50 dark:bg-teal-600 dark:ring-teal-950 [&_svg]:size-7">
          {icon}
        </span>
      ) : null}
      <h1 className="font-display text-3xl leading-tight font-normal tracking-tight text-balance text-foreground sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="text-base text-pretty text-muted-foreground">
          {description}
        </p>
      ) : null}
    </header>
  )
}

export function AuthDivider() {
  const t = useTranslations("auth")
  return (
    <div className="flex items-center gap-3 text-xs tracking-wide text-muted-foreground uppercase">
      <span aria-hidden className="h-px flex-1 bg-border" />
      {t("or")}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  )
}

/** Confirmed email from step one, with a way back to change it. */
export function EmailChip({
  email,
  onChange,
}: {
  email: string
  onChange: () => void
}) {
  const t = useTranslations("auth")
  return (
    <div className="flex items-center gap-3 rounded-full bg-muted/70 py-1.5 pr-1.5 pl-1.5 ring-1 ring-border/60">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-medium text-white uppercase"
      >
        {email.charAt(0)}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-sm text-foreground"
        data-testid="auth-email-chip"
      >
        {email}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full"
        onPress={onChange}
        data-testid="auth-change-email"
      >
        {t("changeEmail")}
      </Button>
    </div>
  )
}

function inboxFor(
  email: string
): { label: "openGmail" | "openOutlook"; href: string } | null {
  const domain = email.split("@")[1]?.toLowerCase() ?? ""
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return {
      label: "openGmail",
      href: "https://mail.google.com/mail/u/0/#search/from%3Aeleva.care+in%3Aanywhere+newer_than%3A1h",
    }
  }
  if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(domain)) {
    return { label: "openOutlook", href: "https://outlook.live.com/mail/" }
  }
  return null
}

/** Inbox shortcut for common webmail providers plus a throttled resend. */
export function InboxActions({
  email,
  onResend,
}: {
  email: string
  onResend: () => Promise<boolean>
}) {
  const t = useTranslations("auth")
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S)
  const [resent, setResent] = useState(false)
  const inbox = inboxFor(email)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  async function resend() {
    setResent(false)
    setCooldown(RESEND_COOLDOWN_S)
    setResent(await onResend())
  }

  return (
    <div className="flex flex-col gap-3">
      {inbox ? (
        <a
          href={inbox.href}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ size: "lg" }), "h-11 w-full")}
        >
          {t(inbox.label)}
          <ArrowSquareOutIcon data-icon="inline-end" />
        </a>
      ) : null}
      <Button
        variant="outline"
        size="lg"
        className="h-11 w-full"
        isDisabled={cooldown > 0}
        onPress={() => void resend()}
        data-testid="auth-resend"
      >
        <PaperPlaneTiltIcon data-icon="inline-start" />
        {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resend")}
      </Button>
      <p
        aria-live="polite"
        className="min-h-5 text-center text-sm text-muted-foreground"
      >
        {resent ? t("resent") : null}
      </p>
    </div>
  )
}

/** Maps Better Auth error codes to localized copy. */
/** Better Auth appends `?error=` to `errorCallbackURL` after a failed OAuth callback. */
export function oauthErrorMessage(
  code: string | null,
  t: (key: string) => string
): string | null {
  if (!code) return null
  if (code === "account_not_linked") return t("accountNotLinked")
  return t("errorGeneric")
}

/** Current page as the OAuth error target, without a stale `error` param. */
export function oauthErrorCallbackURL(): string {
  const url = new URL(window.location.href)
  url.searchParams.delete("error")
  url.searchParams.delete("error_description")
  return url.toString()
}

export function authErrorMessage(
  error: { code?: string; status?: number; message?: string },
  t: (key: string) => string
): string {
  if (error.status === 429) return t("tooManyAttempts")
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return t("invalidCredentials")
    case "EMAIL_NOT_VERIFIED":
      return t("emailNotVerified")
    default:
      return t("errorGeneric")
  }
}
