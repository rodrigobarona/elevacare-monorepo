import { SidebarProvider, SidebarInset } from "@eleva/ui/components/sidebar"
import { TooltipProvider } from "@eleva/ui/components/tooltip"
import { AppSidebar } from "./app-sidebar"
import { DashboardHeader } from "./dashboard-header"
import type { DashboardConfig } from "./nav-types"

interface DashboardShellProps {
  config: DashboardConfig
  /** Extra elements to render in the header (after breadcrumbs etc.) */
  headerSlot?: React.ReactNode
  children: React.ReactNode
}

export function DashboardShell({
  config,
  headerSlot,
  children,
}: DashboardShellProps) {
  const homeUrl =
    config.homeUrl ?? (config.orgSlug ? `/${config.orgSlug}` : "/")

  return (
    <SidebarProvider>
      <TooltipProvider>
        <AppSidebar
          homeUrl={homeUrl}
          navGroups={config.navGroups}
          capabilities={config.capabilities}
          widgetToken={config.widgetToken}
        />
        <SidebarInset>
          <DashboardHeader
            user={config.user}
            accountUrl={config.accountUrl}
            settingsUrl={config.settingsUrl}
            homepageUrl={config.homepageUrl}
            logoutUrl={config.logoutUrl}
          >
            {headerSlot}
          </DashboardHeader>
          <div className="container mx-auto max-w-[1200px] px-4 pt-3 pb-24 sm:px-6 md:px-8 md:pt-10 lg:px-12 xl:px-16">
            {children}
          </div>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  )
}
