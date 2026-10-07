"use client"

import { useSyncExternalStore } from "react"

import { LogoMark } from "@eleva/ui/components/brand"
import { Button } from "@eleva/ui/components/button"
import { fontClassName } from "@eleva/ui/fonts"

// Rendered instead of the root layout, so next-intl messages are unavailable.
type Locale = "en" | "pt" | "es"

const COPY: Record<
  Locale,
  { title: string; description: string; retry: string; reference: string }
> = {
  en: {
    title: "Eleva is having trouble",
    description:
      "Something failed while loading the app. Try again in a moment.",
    retry: "Try again",
    reference: "Reference",
  },
  pt: {
    title: "A Eleva está com dificuldades",
    description:
      "Ocorreu uma falha ao carregar a aplicação. Tente novamente daqui a pouco.",
    retry: "Tentar novamente",
    reference: "Referência",
  },
  es: {
    title: "Eleva tiene problemas",
    description:
      "Algo falló al cargar la aplicación. Inténtalo de nuevo en un momento.",
    retry: "Intentar de nuevo",
    reference: "Referencia",
  },
}

const noopSubscribe = () => () => {}

function useBrowserLocale(): Locale {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      const base = navigator.language.slice(0, 2).toLowerCase()
      return base in COPY ? (base as Locale) : "en"
    },
    () => "en"
  )
}

interface GlobalErrorProps {
  error: Error & { digest?: string }
  unstable_retry: () => void
}

export function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  const locale = useBrowserLocale()
  const t = COPY[locale]
  return (
    <html lang={locale} className={fontClassName} suppressHydrationWarning>
      <body
        className="flex min-h-svh items-center justify-center bg-background p-6 font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
        <div role="alert" className="max-w-md space-y-4 text-center">
          <LogoMark title="" className="mx-auto size-12" />
          <h1 className="font-serif text-2xl tracking-tight text-primary">
            {t.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">
              {t.reference}: {error.digest}
            </p>
          ) : null}
          <Button onPress={unstable_retry}>{t.retry}</Button>
        </div>
      </body>
    </html>
  )
}
