"use client"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@eleva/ui/components/tabs"
import { useTranslations } from "next-intl"
import type { BookingLinkListItem, LocalizedList } from "@eleva/api-client"
import type { Locale } from "@eleva/config"
import { EventTypeForm } from "./event-type-form"
import type { EventTypeFormData } from "./actions"
import { EventTypeDetailsPanel } from "./event-type-details-panel"
import { EventTypeKindPanel } from "./event-type-kind-panel"
import {
  EventTypeModesPanel,
  type LocationOption,
  type ModeRow,
  type ScheduleOption,
} from "./event-type-modes-panel"
import { EventTypePrivateLinksPanel } from "./event-type-private-links-panel"
import type { CalendarIntegrationOption } from "./destination-override-select"

interface Props {
  eventTypeId: string
  workspaceBase: string
  publicPrefix: string
  defaults: Partial<EventTypeFormData>
  detailLists: {
    whatToExpect: LocalizedList
    whatsIncluded: LocalizedList
    exampleQuestions: LocalizedList
  }
  detailsLocale: Locale
  kind: "clinical" | "non_clinical"
  visibility: "public" | "unlisted" | "private"
  modes: ModeRow[]
  schedules: ScheduleOption[]
  locations: LocationOption[]
  profileLanguages: string[]
  serviceCountries: string[]
  worldwideRemote: boolean
  defaultTimezone: string
  links: BookingLinkListItem[]
  integrations: CalendarIntegrationOption[]
  eventTypeDestination: {
    destinationIntegrationId: string | null
    destinationExternalCalendarId: string | null
  }
}

export function EventTypeBuilder({
  eventTypeId,
  workspaceBase,
  publicPrefix,
  defaults,
  detailLists,
  detailsLocale,
  kind,
  visibility,
  modes,
  schedules,
  locations,
  profileLanguages,
  serviceCountries,
  worldwideRemote,
  defaultTimezone,
  links,
  integrations,
  eventTypeDestination,
}: Props) {
  const t = useTranslations("eventTypes.tabs")

  return (
    <Tabs defaultSelectedKey="basics" className="w-full">
      <TabsList variant="line" className="mb-4 w-full max-w-full flex-wrap">
        <TabsTrigger id="basics" data-testid="tab-basics">
          {t("basics")}
        </TabsTrigger>
        <TabsTrigger id="details" data-testid="tab-details">
          {t("details")}
        </TabsTrigger>
        <TabsTrigger id="kind" data-testid="tab-kind">
          {t("kind")}
        </TabsTrigger>
        <TabsTrigger id="policies" data-testid="tab-policies">
          {t("policies")}
        </TabsTrigger>
        <TabsTrigger id="modes" data-testid="tab-modes">
          {t("modes")}
        </TabsTrigger>
        <TabsTrigger id="privateLinks" data-testid="tab-private-links">
          {t("privateLinks")}
        </TabsTrigger>
      </TabsList>

      <TabsContent id="basics">
        <EventTypeForm
          mode="edit"
          eventTypeId={eventTypeId}
          defaultValues={defaults}
          workspaceBase={workspaceBase}
          publicPrefix={publicPrefix}
          panel="basics"
        />
      </TabsContent>

      <TabsContent id="details">
        <EventTypeDetailsPanel
          eventTypeId={eventTypeId}
          initialLists={detailLists}
          defaultLocale={detailsLocale}
        />
      </TabsContent>

      <TabsContent id="kind">
        <EventTypeKindPanel
          eventTypeId={eventTypeId}
          kind={kind}
          visibility={visibility}
        />
      </TabsContent>

      <TabsContent id="policies">
        <EventTypeForm
          mode="edit"
          eventTypeId={eventTypeId}
          defaultValues={defaults}
          workspaceBase={workspaceBase}
          publicPrefix={publicPrefix}
          panel="policies"
        />
      </TabsContent>

      <TabsContent id="modes">
        <EventTypeModesPanel
          eventTypeId={eventTypeId}
          modes={modes}
          schedules={schedules}
          locations={locations}
          profileLanguages={profileLanguages}
          serviceCountries={serviceCountries}
          worldwideRemote={worldwideRemote}
          eventTypeKind={kind}
          defaultTimezone={defaultTimezone}
          integrations={integrations}
          eventTypeDestination={eventTypeDestination}
        />
      </TabsContent>

      <TabsContent id="privateLinks">
        <EventTypePrivateLinksPanel
          eventTypeId={eventTypeId}
          links={links}
          modes={modes}
          schedules={schedules}
          locations={locations}
        />
      </TabsContent>
    </Tabs>
  )
}
