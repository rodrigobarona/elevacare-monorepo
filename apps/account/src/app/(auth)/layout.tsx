import { getLocale, getTranslations } from "next-intl/server"
import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import { CheckIcon } from "@eleva/icons"
import { gatewayMarketingPath } from "@eleva/site-chrome/gateway-marketing-url"
import { Logo } from "@eleva/ui/components/brand"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations("auth")
  const rawLocale = await getLocale()
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale
  const homeHref = gatewayMarketingPath(locale, "/")
  const careWords = t.raw("careWords") as string[]
  const points = t.raw("brandPoints") as string[]

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative isolate hidden flex-col justify-between overflow-hidden bg-teal-900 p-10 text-white lg:flex xl:p-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="auth-aurora absolute -top-32 -left-24 size-[28rem] rounded-full bg-teal-500/40 blur-3xl" />
          <div className="auth-aurora auth-aurora-slow absolute top-1/3 -right-32 size-[26rem] rounded-full bg-emerald-300/25 blur-3xl" />
          <div className="auth-aurora absolute -bottom-40 left-1/4 size-[30rem] rounded-full bg-amber-200/20 blur-3xl [animation-delay:-6s]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.07)_1px,transparent_0)] bg-size-[22px_22px]" />
        </div>

        <a
          href={homeHref}
          aria-label="Eleva.care"
          className="w-fit self-start rounded-sm"
        >
          <Logo className="h-8 text-white" />
        </a>

        <div className="max-w-lg">
          <p className="font-heading text-5xl leading-[1.08] text-balance xl:text-6xl">
            {t("brandHeadlinePrefix")}
            <span className="auth-word-cycle mt-1 grid text-teal-100 italic">
              {careWords.map((word, index) => (
                <span
                  key={word}
                  className="[grid-area:1/1]"
                  style={{ animationDelay: `${index * 2.5}s` }}
                  aria-hidden={index > 0 || undefined}
                >
                  {word}
                </span>
              ))}
            </span>
          </p>
          <ul className="mt-10 flex flex-col gap-3">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3 text-teal-50">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <CheckIcon weight="bold" className="size-3.5" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-teal-100/70">© Eleva.care</p>
      </aside>

      <main className="relative isolate flex flex-col overflow-hidden px-5 py-12 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 -z-10 size-96 rounded-full bg-teal-100/60 blur-3xl dark:bg-teal-900/30"
        />
        <a
          href={homeHref}
          aria-label="Eleva.care"
          className="mb-10 w-fit shrink-0 rounded-sm lg:hidden"
        >
          <Logo className="h-7" />
        </a>
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  )
}
