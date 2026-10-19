"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type { LocalizedList } from "@eleva/api-client"
import { localeNames, locales, type Locale } from "@eleva/config"
import { PROFILE_CONTENT_LIMITS } from "@eleva/config/expert-profile-content"
import { PlusIcon, Trash2 } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Input } from "@eleva/ui/components/input"
import { updateEventTypeDetailsAction } from "./actions"

const LIST_FIELDS = [
  "whatToExpect",
  "whatsIncluded",
  "exampleQuestions",
] as const
type ListField = (typeof LIST_FIELDS)[number]
type Lists = Record<ListField, LocalizedList>

/** Trims items and drops empty ones so blank rows never reach the API. */
function cleanList(list: LocalizedList): LocalizedList {
  const cleaned: LocalizedList = {}
  for (const locale of locales) {
    const items = (list[locale] ?? [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    if (items.length > 0) cleaned[locale] = items
  }
  return cleaned
}

export function EventTypeDetailsPanel({
  eventTypeId,
  initialLists,
  defaultLocale,
}: {
  eventTypeId: string
  initialLists: Lists
  defaultLocale: Locale
}) {
  const t = useTranslations("eventTypes.details")
  const router = useRouter()
  const [activeLocale, setActiveLocale] = useState<Locale>(defaultLocale)
  const [lists, setLists] = useState<Lists>(initialLists)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, startSaving] = useTransition()

  function setItems(field: ListField, items: string[]) {
    setLists((current) => ({
      ...current,
      [field]: { ...current[field], [activeLocale]: items },
    }))
    setIsDirty(true)
  }

  function handleSave() {
    startSaving(async () => {
      const result = await updateEventTypeDetailsAction(eventTypeId, {
        whatToExpect: cleanList(lists.whatToExpect),
        whatsIncluded: cleanList(lists.whatsIncluded),
        exampleQuestions: cleanList(lists.exampleQuestions),
      })
      if (!result.ok) {
        toast.error(result.message ?? t("saveFailed"))
        return
      }
      toast.success(t("saved"))
      setIsDirty(false)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className="flex gap-1 border-b"
          role="group"
          aria-label={t("language")}
        >
          {locales.map((locale) => (
            <button
              key={locale}
              type="button"
              aria-pressed={activeLocale === locale}
              onClick={() => setActiveLocale(locale)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeLocale === locale
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {localeNames[locale]}
            </button>
          ))}
        </div>

        {LIST_FIELDS.map((field) => (
          <ListEditor
            key={`${field}:${activeLocale}`}
            field={field}
            items={lists[field][activeLocale] ?? []}
            isDisabled={isSaving}
            onChange={(items) => setItems(field, items)}
          />
        ))}

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t("emptyHidden")}</p>
          <Button
            type="button"
            isDisabled={!isDirty || isSaving}
            onPress={handleSave}
            data-testid="event-type-details-save"
          >
            {isSaving ? t("saving") : t("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ListEditor({
  field,
  items,
  isDisabled,
  onChange,
}: {
  field: ListField
  items: string[]
  isDisabled: boolean
  onChange: (items: string[]) => void
}) {
  const t = useTranslations("eventTypes.details")
  const headingId = `event-type-${field}-heading`

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div>
        <h3 id={headingId} className="text-sm font-medium">
          {t(`${field}.label`)}
        </h3>
        <p className="text-sm text-muted-foreground">{t(`${field}.hint`)}</p>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <Input
              aria-label={t("itemLabel", {
                list: t(`${field}.label`),
                number: index + 1,
              })}
              value={item}
              maxLength={PROFILE_CONTENT_LIMITS.listItemText}
              placeholder={index === 0 ? t(`${field}.placeholder`) : undefined}
              disabled={isDisabled}
              onChange={(event) =>
                onChange(
                  items.map((current, i) =>
                    i === index ? event.target.value : current
                  )
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("removeItem", { number: index + 1 })}
              isDisabled={isDisabled}
              onPress={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      {items.length < PROFILE_CONTENT_LIMITS.listItems ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          isDisabled={isDisabled}
          onPress={() => onChange([...items, ""])}
        >
          <PlusIcon className="mr-1.5 size-3.5" />
          {t("addItem")}
        </Button>
      ) : null}
    </section>
  )
}
