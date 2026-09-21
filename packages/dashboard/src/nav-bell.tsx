"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { createApiClient, type ListInboxResponse } from "@eleva/api-client"
import { BellIcon } from "@eleva/icons"
import { Badge } from "@eleva/ui/components/badge"
import { Button, LinkButton } from "@eleva/ui/components/button"
import {
  Popover,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@eleva/ui/components/popover"

const POLL_MS = 30_000

interface NavBellProps {
  inboxUrl: string
  apiBaseUrl: string
}

export function NavBell({ inboxUrl, apiBaseUrl }: NavBellProps) {
  const t = useTranslations("inbox")
  const client = useMemo(
    () => createApiClient({ baseUrl: apiBaseUrl }),
    [apiBaseUrl]
  )
  const { data, mutate } = useSWR<ListInboxResponse>(
    ["inbox-bell", apiBaseUrl, inboxUrl],
    () => client.notifications.list({ unread: true, limit: 8 }),
    { refreshInterval: POLL_MS }
  )

  const unreadCount = data?.unreadCount ?? 0
  const items = data?.items ?? []

  async function handleMarkAll() {
    await client.notifications.markReadAll()
    await mutate()
  }

  async function handleMarkRead(id: string) {
    await client.notifications.markRead(id)
    await mutate()
  }

  return (
    <PopoverTrigger>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("openInbox")}
        className="relative"
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <Badge
            variant="destructive"
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </Button>
      <Popover className="w-80 p-3" placement="bottom end">
        <PopoverHeader className="flex-row items-center justify-between gap-2">
          <PopoverTitle>{t("title")}</PopoverTitle>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onPress={() => void handleMarkAll()}
            >
              {t("markAllRead")}
            </Button>
          ) : null}
        </PopoverHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {items.map((item) => {
              const content = (
                <>
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
                    {item.body}
                  </span>
                </>
              )
              const className =
                "h-auto w-full flex-col items-start gap-0.5 px-2 py-2 text-left whitespace-normal"
              return (
                <li key={item.id}>
                  {item.href ? (
                    <LinkButton
                      href={item.href}
                      variant="ghost"
                      className={className}
                      onPress={() => void handleMarkRead(item.id)}
                    >
                      {content}
                    </LinkButton>
                  ) : (
                    <Button
                      variant="ghost"
                      className={className}
                      onPress={() => void handleMarkRead(item.id)}
                    >
                      {content}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <LinkButton href={inboxUrl} variant="ghost" size="sm">
          {t("viewAll")}
        </LinkButton>
      </Popover>
    </PopoverTrigger>
  )
}
