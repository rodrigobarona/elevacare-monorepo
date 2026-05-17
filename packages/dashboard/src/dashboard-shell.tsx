import { SidebarProvider, SidebarInset } from "@eleva/ui/components/sidebar"
import { TooltipProvider } from "@eleva/ui/components/tooltip"
import { AppSidebar } from "./app-sidebar"
import { DashboardHeader } from "./dashboard-header"
import type { DashboardConfig } from "./nav-types"

interface DashboardShellProps {
  config: DashboardConfig
  /** Extra elements to render in the header (after org switcher) */
  headerSlot?: React.ReactNode
  children: React.ReactNode
}

export function DashboardShell({
  config,
  headerSlot,
  children,
}: DashboardShellProps) {
  const homeUrl = config.orgSlug ? `/${config.orgSlug}` : "/"

  return (
    <SidebarProvider>
      <TooltipProvider>
        <AppSidebar
          homeUrl={homeUrl}
          navGroups={config.navGroups}
          capabilities={config.capabilities}
        />
        <SidebarInset>
          <DashboardHeader
            user={config.user}
            widgetToken={config.widgetToken}
            accountUrl={config.accountUrl}
            settingsUrl={config.settingsUrl}
            logoutUrl={config.logoutUrl}
          >
            {headerSlot}
          </DashboardHeader>
          <div className="mx-auto w-full max-w-5xl px-6 py-8">{children}</div>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  )
}
