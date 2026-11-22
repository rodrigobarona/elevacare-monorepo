"use client"

import { useSyncExternalStore } from "react"
import type { ErrorInfo } from "next/error"

import { LEGAL_ENTITY } from "@eleva/config/legal-entity"
import { LogoMark } from "@eleva/ui/components/brand"
import { Button } from "@eleva/ui/components/button"
import {
  ErrorReference,
  ErrorRetryLabel,
  errorDigest,
  errorSupportLinkClassName,
  useErrorRetry,
} from "@eleva/ui/components/error-recovery"
import { fontClassName } from "@eleva/ui/fonts"
import { cn } from "@eleva/ui/lib/utils"

// Rendered instead of the root layout, so next-intl messages are unavailable.
// The wording follows `routeStates` in `@eleva/dashboard` (a test there keeps
// the two in step), so the two error pages read as one family.
type Locale = "en" | "pt" | "es"

export const GLOBAL_ERROR_COPY: Record<
  Locale,
  {
    title: string
    description: string
    offline: string
    retry: string
    retrying: string
    retryFailed: string
    /** `{email}` marks where the support address goes. */
    support: string
    supportNoReference: string
    /** `{reference}` marks where the reference goes. */
    emailSubject: string
    emailSubjectNoReference: string
    reference: string
    copyReference: string
    copied: string
    referenceCopied: string
    referenceSelected: string
  }
> = {
  en: {
    title: "We couldn’t load Eleva",
    description: "Something went wrong on our side. Try again in a moment.",
    offline: "You seem to be offline. Check your connection, then try again.",
    retry: "Try again",
    retrying: "Trying again…",
    retryFailed: "Still not loading. It may need a minute.",
    support: "If it keeps happening, email {email} with this reference.",
    supportNoReference:
      "If it keeps happening, email {email} and tell us which page you were on.",
    emailSubject: "Eleva reference {reference}",
    emailSubjectNoReference: "A page didn’t load on Eleva",
    reference: "Reference",
    copyReference: "Copy reference",
    copied: "Copied",
    referenceCopied: "Reference copied",
    referenceSelected:
      "We couldn’t copy it for you. The reference is selected, so you can copy it yourself.",
  },
  pt: {
    title: "Não foi possível carregar a Eleva",
    description: "Algo falhou do nosso lado. Tente novamente daqui a pouco.",
    offline:
      "Parece que está sem ligação à internet. Verifique a ligação e tente novamente.",
    retry: "Tentar novamente",
    retrying: "A tentar novamente…",
    retryFailed: "Ainda não carregou. Pode precisar de um minuto.",
    support:
      "Se continuar a acontecer, escreva para {email} com esta referência.",
    supportNoReference:
      "Se continuar a acontecer, escreva para {email} e diga-nos em que página estava.",
    emailSubject: "Referência Eleva {reference}",
    emailSubjectNoReference: "Uma página não carregou na Eleva",
    reference: "Referência",
    copyReference: "Copiar referência",
    copied: "Copiada",
    referenceCopied: "Referência copiada",
    referenceSelected:
      "Não foi possível copiar. A referência está selecionada, para a poder copiar.",
  },
  es: {
    title: "No pudimos cargar Eleva",
    description:
      "Algo falló por nuestra parte. Inténtalo de nuevo en un momento.",
    offline:
      "Parece que no tienes conexión a internet. Compruébala e inténtalo de nuevo.",
    retry: "Intentar de nuevo",
    retrying: "Intentando de nuevo…",
    retryFailed: "Sigue sin cargar. Puede que necesite un minuto.",
    support: "Si sigue ocurriendo, escribe a {email} con esta referencia.",
    supportNoReference:
      "Si sigue ocurriendo, escribe a {email} y cuéntanos en qué página estabas.",
    emailSubject: "Referencia de Eleva {reference}",
    emailSubjectNoReference: "Una página no cargó en Eleva",
    reference: "Referencia",
    copyReference: "Copiar referencia",
    copied: "Copiada",
    referenceCopied: "Referencia copiada",
    referenceSelected:
      "No pudimos copiarla. La referencia está seleccionada para que puedas copiarla.",
  },
}

const noopSubscribe = () => () => {}

function isLocale(value: string | undefined): value is Locale {
  // Own keys only: a cookie that says "constructor" is not a language.
  return value !== undefined && Object.hasOwn(GLOBAL_ERROR_COPY, value)
}

/**
 * Eleva's language and theme cookies (`cookieName` in `@eleva/config/i18n`
 * and `@eleva/config/theme`; a test keeps them equal). Written here so this
 * page does not load those modules.
 */
export const LOCALE_COOKIE = "ELEVA_LOCALE"
export const THEME_COOKIE = "ELEVA_THEME"

/**
 * The last cookie of that name, as the rest of Eleva reads them: a browser
 * can hold an older host-only copy beside the shared one.
 */
function savedCookie(name: string): string | undefined {
  try {
    return document.cookie
      .split(/;\s*/)
      .map((pair) => pair.split("="))
      .filter(([key]) => key === name)
      .at(-1)?.[1]
  } catch {
    // Cookies cannot be read here (a sandboxed frame): go by the browser.
    return undefined
  }
}

/** The language chosen in Eleva (its cookie), then the browser's. */
export function readGlobalErrorLocale(): Locale {
  const saved = savedCookie(LOCALE_COOKIE)
  if (isLocale(saved)) return saved
  const browser = navigator.language.slice(0, 2).toLowerCase()
  return isLocale(browser) ? browser : "en"
}

/** The theme chosen in Eleva (its cookie), then the system's. */
export function readGlobalErrorDark(): boolean {
  const saved = savedCookie(THEME_COOKIE)
  if (saved === "dark") return true
  if (saved === "light") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function useLocale(): Locale {
  return useSyncExternalStore(noopSubscribe, readGlobalErrorLocale, () => "en")
}

type GlobalErrorProps = Pick<ErrorInfo, "error" | "retry">

/** The fallback's content, apart from the document it needs around it. */
export function GlobalErrorContent({
  error,
  retry,
  locale,
}: GlobalErrorProps & { locale: Locale }) {
  const t = GLOBAL_ERROR_COPY[locale]
  const reference = errorDigest(error)
  const { offline, stillFailing, retryButtonProps } = useErrorRetry(retry)
  const email = LEGAL_ENTITY.supportEmail
  const subject = reference
    ? t.emailSubject.replace("{reference}", reference)
    : t.emailSubjectNoReference
  const [beforeEmail, afterEmail] = (
    reference ? t.support : t.supportNoReference
  ).split("{email}")

  return (
    <main className="w-full max-w-md text-center text-balance">
      <LogoMark title="" className="mx-auto size-12" />
      {/* One alert: see `RouteError` for why the status line lives in it. */}
      <div role="alert" className="mt-4 space-y-2">
        <h1 className="font-heading text-lg font-medium tracking-tight">
          {t.title}
        </h1>
        <p className="text-sm/relaxed text-muted-foreground">
          {offline ? t.offline : t.description}
        </p>
        {/* Always rendered, so the page keeps its height between states. */}
        <p className="min-h-10 text-sm text-foreground sm:min-h-5">
          {stillFailing ? t.retryFailed : null}
        </p>
      </div>
      <div className="mt-4 flex flex-col items-stretch sm:items-center">
        <Button {...retryButtonProps}>
          <ErrorRetryLabel
            isPending={retryButtonProps.isPending}
            label={t.retry}
            pendingLabel={t.retrying}
          />
        </Button>
      </div>
      <div className="mt-8 space-y-3 border-t pt-6">
        <p className="text-sm/relaxed text-muted-foreground">
          {beforeEmail}
          <a
            href={`mailto:${email}?subject=${encodeURIComponent(subject)}`}
            className={errorSupportLinkClassName}
          >
            {email}
          </a>
          {afterEmail}
        </p>
        {reference ? (
          <ErrorReference
            label={t.reference}
            reference={reference}
            copyLabel={t.copyReference}
            copiedLabel={t.copied}
            copiedAnnouncement={t.referenceCopied}
            copyFailedAnnouncement={t.referenceSelected}
          />
        ) : null}
      </div>
    </main>
  )
}

/**
 * Default `global-error.tsx` body: the whole app failed, so it renders its own
 * document. The props are Next's own (`ErrorInfo`), so a renamed prop fails
 * typecheck instead of leaving "Try again" without a handler.
 */
export function GlobalError({ error, retry }: GlobalErrorProps) {
  const locale = useLocale()
  const dark = useSyncExternalStore(
    noopSubscribe,
    readGlobalErrorDark,
    () => false
  )
  return (
    <html
      lang={locale}
      className={cn(fontClassName, dark && "dark")}
      suppressHydrationWarning
    >
      {/* `metadata` is not read here; React hoists this into the head. */}
      <title>{GLOBAL_ERROR_COPY[locale].title}</title>
      <body
        className="flex min-h-svh items-center justify-center bg-background p-6 font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
        <GlobalErrorContent error={error} retry={retry} locale={locale} />
      </body>
    </html>
  )
}
