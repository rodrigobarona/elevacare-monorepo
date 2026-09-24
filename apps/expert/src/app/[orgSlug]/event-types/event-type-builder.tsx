"use client"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@eleva/ui/components/tabs"
import { useTranslations } from "next-intl"
import type { BookingLinkListItem } from "@eleva/api-client"
import { EventTypeForm } from "./event-type-form"
import type { EventTypeFormData } from "./actions"
import { EventTypeKindPanel } from "./event-type-kind-panel"
import {
  EventTypeModesPanel,
  type LocationOption,
  type ModeRow,
  type ScheduleOption,
} from "./event-type-modes-panel"
import { EventTypePrivateLinksPanel } from "./event-type-private-links-panel"

interface Props {
  eventTypeId: string
  workspaceBase: string
  defaults: Partial<EventTypeFormData>
  kind: "clinical" | "non_clinical"
  visibility: "public" | "unlisted" | "private"
  modes: ModeRow[]
  schedules: ScheduleOption[]
  locations: LocationOption[]
  profileLanguages: string[]
  serviceCountries: string[]
  worldwideRemote: boolean
  links: BookingLinkListItem[]
}

export function EventTypeBuilder({
  eventTypeId,
  workspaceBase,
  defaults,
  kind,
  visibility,
  modes,
  schedules,
  locations,
  profileLanguages,
  serviceCountries,
  worldwideRemote,
  links,
}: Props) {
  const t = useTranslations("eventTypes.tabs")

  return (
    <Tabs defaultSelectedKey="basics" className="w-full">
      <TabsList variant="line" className="mb-4 w-full max-w-full flex-wrap">
        <TabsTrigger id="basics">{t("basics")}</TabsTrigger>
        <TabsTrigger id="kind">{t("kind")}</TabsTrigger>
        <TabsTrigger id="policies">{t("policies")}</TabsTrigger>
        <TabsTrigger id="modes">{t("modes")}</TabsTrigger>
        <TabsTrigger id="privateLinks">{t("privateLinks")}</TabsTrigger>
      </TabsList>

      <TabsContent id="basics">
        <EventTypeForm
          mode="edit"
          eventTypeId={eventTypeId}
          defaultValues={defaults}
          workspaceBase={workspaceBase}
          panel="basics"
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
