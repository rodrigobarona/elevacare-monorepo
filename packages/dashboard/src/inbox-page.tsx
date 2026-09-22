"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import useSWR, { useSWRConfig } from "swr"
import { createApiClient, type ListInboxResponse } from "@eleva/api-client"
import { AccountPageHeader } from "./account-page-header"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { revalidateInboxCaches } from "./inbox-swr"

interface InboxPageProps {
  apiBaseUrl: string
  orgSlug: string
}

export function InboxPage({ apiBaseUrl, orgSlug }: InboxPageProps) {
  const t = useTranslations("inbox")
  const { mutate: globalMutate } = useSWRConfig()
  const client = useMemo(
    () => createApiClient({ baseUrl: apiBaseUrl }),
    [apiBaseUrl]
  )
  const { data, error, isLoading } = useSWR<ListInboxResponse>(
    ["inbox-page", apiBaseUrl, orgSlug],
    () => client.notifications.list({ limit: 50 }),
    { refreshInterval: 30_000 }
  )

  const items = data?.items ?? []
  const unreadCount = data?.unreadCount ?? 0

  async function handleMarkAll() {
    await client.notifications.markReadAll()
    await revalidateInboxCaches(globalMutate, apiBaseUrl)
  }

  async function handleMarkRead(id: string) {
    await client.notifications.markRead(id)
    await revalidateInboxCaches(globalMutate, apiBaseUrl)
  }

  return (
    <div className="space-y-8">
      <AccountPageHeader
        title={t("title")}
        description={t("description")}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" onPress={() => void handleMarkAll()}>
              {t("markAllRead")}
            </Button>
          ) : null
        }
      />
      {isLoading && items.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-muted-foreground">{t("error")}</p>
      ) : null}
      {!error && items.length === 0 && !isLoading ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : null}
      {!error && items.length > 0 ? (
        <ul className="divide-y divide-border rounded-3xl border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="space-y-1">
                <p
                  className={
                    item.readAt
                      ? "text-sm font-medium text-muted-foreground"
                      : "text-sm font-medium"
                  }
                >
                  {item.title}
                </p>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {item.href ? (
                  <LinkButton href={item.href} variant="ghost" size="sm">
                    {t("open")}
                  </LinkButton>
                ) : null}
                {!item.readAt ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => void handleMarkRead(item.id)}
                  >
                    {t("markRead")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
