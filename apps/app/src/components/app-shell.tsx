import Link from "next/link"
import { useTranslations } from "next-intl"
import type { ElevaSession } from "@eleva/auth"

/**
 * Sidebar + topbar frame for every authenticated page. Renders a small
 * set of nav items gated by capability. Stays intentionally plain \u2014
 * shadcn sidebar primitives land in S2.
 */

const NAV: Array<{
  href: string
  labelKey: string
  needs?: string
  matchPrefix: string
}> = [
  {
    href: "/patient",
    labelKey: "nav.patient",
    needs: "appointments:view_own",
    matchPrefix: "/patient",
  },
  {
    href: "/expert",
    labelKey: "nav.expert",
    needs: "events:manage",
    matchPrefix: "/expert",
  },
  {
    href: "/expert/finance",
    labelKey: "nav.finance",
    needs: "payouts:view_own",
    matchPrefix: "/expert/finance",
  },
  {
    href: "/org",
    labelKey: "nav.org",
    needs: "members:manage",
    matchPrefix: "/org",
  },
  {
    href: "/admin",
    labelKey: "nav.admin",
    needs: "audit:view_all",
    matchPrefix: "/admin",
  },
  {
    href: "/admin/become-partner",
    labelKey: "nav.adminApplications",
    needs: "applications:review",
    matchPrefix: "/admin/become-partner",
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    matchPrefix: "/settings",
  },
]

export function AppShell({
  session,
  children,
}: {
  session: ElevaSession
  children: React.ReactNode
}) {
  const t = useTranslations()
  const visible = NAV.filter(
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
