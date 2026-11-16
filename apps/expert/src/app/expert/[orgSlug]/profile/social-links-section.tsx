"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  isAllowedSocialLinkUrl,
  SOCIAL_LINK_KINDS,
  type SocialLinkKind,
} from "@eleva/config/expert-profile-content"
import { PlusIcon, SOCIAL_LINK_ICONS, Trash2 } from "@eleva/icons"
import type { ExpertSocialLink } from "@eleva/api-client"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { useProfileSave } from "./use-profile-save"

type Row = ExpertSocialLink & { rowId: string }

function isSocialLinkKind(value: unknown): value is SocialLinkKind {
  return (
    typeof value === "string" &&
    (SOCIAL_LINK_KINDS as readonly string[]).includes(value)
  )
}

export function SocialLinksSection({
  initialLinks,
}: {
  initialLinks: ExpertSocialLink[]
}) {
  const t = useTranslations("publicProfile")
  const [rows, setRows] = useState<Row[]>(() =>
    initialLinks.map((link, index) => ({ ...link, rowId: `link-${index}` }))
  )
  const [isDirty, setIsDirty] = useState(false)
  const { isSaving, save } = useProfileSave()

  const usedKinds = new Set(rows.map((row) => row.kind))
  const nextKind = SOCIAL_LINK_KINDS.find((kind) => !usedKinds.has(kind))

  function update(rowId: string, patch: Partial<ExpertSocialLink>) {
    setRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    )
    setIsDirty(true)
  }

  function handleSave() {
    const links = rows
      .map(({ kind, url }) => ({ kind, url: url.trim() }))
      .filter((link) => link.url.length > 0)
    if (links.some((link) => !isAllowedSocialLinkUrl(link.kind, link.url))) {
      toast.error(t("social.invalid"))
      return
    }
    save({ socialLinks: links }, { onSaved: () => setIsDirty(false) })
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle>{t("social.title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("social.description")}
        </SettingsFieldsetDescription>
        <div className="mt-4 space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("social.empty")}</p>
          ) : null}
          {rows.map((row) => {
            const Icon = SOCIAL_LINK_ICONS[row.kind]
            const isInvalid =
              row.url.trim().length > 0 &&
              !isAllowedSocialLinkUrl(row.kind, row.url.trim())
            return (
              <div key={row.rowId} className="flex items-start gap-2">
                <Select
                  aria-label={t("social.network")}
                  className="w-40 shrink-0"
                  selectedKey={row.kind}
                  isDisabled={isSaving}
                  onSelectionChange={(key) => {
                    if (isSocialLinkKind(key)) update(row.rowId, { kind: key })
                  }}
                >
                  <SelectTrigger className="w-full">
                    <Icon
                      aria-hidden
                      className="size-4 text-muted-foreground"
                    />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_LINK_KINDS.map((kind) => (
                      <SelectItem
                        key={kind}
                        id={kind}
                        isDisabled={kind !== row.kind && usedKinds.has(kind)}
                      >
                        {t(`social.kinds.${kind}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="url"
                  inputMode="url"
                  aria-label={t("social.url")}
                  aria-invalid={isInvalid || undefined}
                  className="min-w-0 flex-1"
                  value={row.url}
                  placeholder={t(`social.placeholders.${row.kind}`)}
                  disabled={isSaving}
                  onChange={(event) =>
                    update(row.rowId, { url: event.target.value })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("social.remove", {
                    network: t(`social.kinds.${row.kind}`),
                  })}
                  isDisabled={isSaving}
                  onPress={() => {
                    setRows((current) =>
                      current.filter((item) => item.rowId !== row.rowId)
                    )
                    setIsDirty(true)
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )
          })}
        </div>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        <SettingsFieldsetActions>
          {nextKind ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              isDisabled={isSaving}
              onPress={() => {
                setRows((current) => [
                  ...current,
                  { kind: nextKind, url: "", rowId: crypto.randomUUID() },
                ])
              }}
            >
              <PlusIcon className="mr-1.5 size-3.5" />
              {t("social.add")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            isDisabled={!isDirty || isSaving}
            onPress={handleSave}
          >
            {isSaving ? t("saving") : t("save")}
          </Button>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
