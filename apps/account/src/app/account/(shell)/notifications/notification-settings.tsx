"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type { MeProfile } from "@eleva/api-client"
import { LinkButton } from "@eleva/ui/components/button"
import { InfoPopover } from "@eleva/ui/components/info-popover"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetStatus,
  SettingsFieldsetTitle,
  SettingsRow,
} from "@eleva/ui/components/settings-fieldset"
import { Switch } from "@eleva/ui/components/switch"
import { updateNotificationPreferences } from "./actions"

type Preference = MeProfile["preferences"][number]
type Channel = "email" | "in_app"
type Category = "booking" | "reminder" | "payment" | "system"

const CHANNELS: Channel[] = ["email", "in_app"]
const CATEGORIES: Category[] = ["booking", "reminder", "payment", "system"]

/**
 * Payment and account messages are always sent, whatever the stored
 * preference (`REQUIRED_NOTIFICATION_CATEGORIES` in @eleva/notifications),
 * so they show as switches that are on and cannot be changed. Text messages
 * and quiet hours need a verified phone number, which no page collects yet,
 * so they are not offered here.
 */
function isLocked(category: Category): boolean {
  return category === "payment" || category === "system"
}

function key(channel: Channel, category: Category): string {
  return `${channel}:${category}`
}

function initialState(rows: Preference[]): Map<string, boolean> {
  const state = new Map<string, boolean>()
  for (const channel of CHANNELS) {
    for (const category of CATEGORIES) {
      const row = rows.find(
        (pref) => pref.channel === channel && pref.category === category
      )
      state.set(
        key(channel, category),
        isLocked(category) || (row?.enabled ?? true)
      )
    }
  }
  return state
}

export function NotificationSettings({
  preferences,
}: {
  preferences: Preference[]
}) {
  const t = useTranslations("notificationSettings")
  const [enabled, setEnabled] = useState(() => initialState(preferences))
  const [pending, setPending] = useState(false)

  async function toggle(channel: Channel, category: Category, on: boolean) {
    const previous = enabled
    const next = new Map(enabled)
    next.set(key(channel, category), on)
    setEnabled(next)
    setPending(true)
    try {
      const { ok } = await updateNotificationPreferences({
        preferences: CHANNELS.flatMap((ch) =>
          CATEGORIES.map((cat) => ({
            channel: ch,
            category: cat,
            enabled: next.get(key(ch, cat)) ?? true,
          }))
        ),
      }).catch(() => ({ ok: false }))
      if (!ok) {
        setEnabled(previous)
        toast.error(t("error"))
        return
      }
      toast.success(t("saved"))
    } finally {
      setPending(false)
    }
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle as="h2">{t("card.title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("card.description")}{" "}
          <InfoPopover
            label={t("channelInfoLabel")}
            title={t("channelInfoTitle")}
          >
            <p>{t("channelInfo")}</p>
          </InfoPopover>
        </SettingsFieldsetDescription>
        <div className="mt-6">
          {CATEGORIES.map((category) => {
            const locked = isLocked(category)
            const descriptionId = `notify-${category}-description`
            return (
              <SettingsRow
                key={category}
                stack
                title={t(`categories.${category}.title`)}
                description={
                  <span id={descriptionId}>
                    {t(`categories.${category}.description`)}
                  </span>
                }
                meta={
                  locked
                    ? t("alwaysOn")
                    : category === "booking" &&
                        !enabled.get(key("email", "booking"))
                      ? t("categories.booking.emailOff")
                      : null
                }
                data-testid={`notify-${category}`}
              >
                {CHANNELS.map((channel) => (
                  // The switch is the track only; the channel name sits
                  // beside it, and the accessible name says both.
                  <span
                    key={channel}
                    className="flex w-28 items-center gap-2 text-sm"
                  >
                    <Switch
                      size="sm"
                      aria-label={`${t(`channel.${channel}`)}: ${t(`categories.${category}.title`)}`}
                      aria-describedby={descriptionId}
                      isSelected={enabled.get(key(channel, category))}
                      isDisabled={locked || pending}
                      onChange={(on) => void toggle(channel, category, on)}
                      data-testid={`notify-${channel}-${category}`}
                    />
                    <span aria-hidden>{t(`channel.${channel}`)}</span>
                  </span>
                ))}
              </SettingsRow>
            )
          })}
        </div>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        <SettingsFieldsetStatus>{t("newsHint")}</SettingsFieldsetStatus>
        <SettingsFieldsetActions>
          <LinkButton href="/account/privacy" variant="outline" size="sm">
            {t("newsLink")}
          </LinkButton>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
