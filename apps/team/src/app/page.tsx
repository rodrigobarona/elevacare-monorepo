import { guardSession, getWidgetToken } from "@eleva/auth"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eleva/ui/components/empty"
import { OrgSwitcherWidget } from "@eleva/dashboard/org-switcher-widget"
import { Building2 } from "@eleva/icons"

export default async function RootPage() {
  const session = await guardSession()
  const widgetToken = await getWidgetToken(
    session.user.workosUserId,
    session.workosOrgId
  )

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2 />
          </EmptyMedia>
          <EmptyTitle>Select an organization</EmptyTitle>
          <EmptyDescription>
            Choose which organization to access.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <OrgSwitcherWidget authToken={widgetToken} />
        </EmptyContent>
      </Empty>
    </main>
  )
}
