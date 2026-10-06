import { useTranslations } from "next-intl"
import { Logo } from "@eleva/ui/components/brand"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations("auth")

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-teal-800 p-10 text-white lg:flex">
        <Logo className="h-8 text-white" />
        <div className="max-w-md">
          <p className="font-heading text-4xl leading-tight">
            {t("brandHeadline")}
          </p>
          <p className="mt-4 text-lg text-teal-100">{t("brandBody")}</p>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-teal-700/60 blur-3xl"
        />
      </aside>
      <main className="flex flex-col items-center justify-center px-4 py-10">
        <Logo className="mb-8 h-7 lg:hidden" />
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
