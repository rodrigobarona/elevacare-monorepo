import Link from "next/link"
import { useTranslations } from "next-intl"
import type { ElevaSession } from "@eleva/auth"

interface NavItem {
  href: string
  labelKey: string
  needs?: string
}

function buildNav(orgSlug: string): NavItem[] {
  const s = `/${orgSlug}`
  return [
    { href: s, labelKey: "nav.dashboard", needs: "appointments:view_own" },
    { href: "/account/profile", labelKey: "nav.settings" },
  ]
}

export function AppShell({
  session,
  children,
}: {
  session: ElevaSession
  children: React.ReactNode
}) {
  const t = useTranslations()
  const nav = buildNav(session.orgSlug ?? "")
  const visible = nav.filter(
    (item) => !item.needs || session.capabilities.includes(item.needs)
  )

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-64 border-r p-4 md:block">
        <div className="mb-6 text-sm font-medium">Eleva</div>
        <nav className="space-y-1">
          {visible.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
        <form action="/logout" method="POST" className="mt-6">
          <button
            className="text-xs text-muted-foreground hover:underline"
            type="submit"
          >
            {t("nav.logout")}
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
