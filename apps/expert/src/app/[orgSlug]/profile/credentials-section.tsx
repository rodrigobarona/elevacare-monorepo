"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  ExpertCredentialSchema,
  type ExpertCredential,
} from "@eleva/api-client"
import { PROFILE_CONTENT_LIMITS } from "@eleva/config/expert-profile-content"
import { PlusIcon, Trash2 } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { useProfileSave } from "./use-profile-save"

type Row = { rowId: string; title: string; institution: string; year: string }

function toRow(credential: ExpertCredential, index: number): Row {
  return {
    rowId: `credential-${index}`,
    title: credential.title,
    institution: credential.institution ?? "",
    year: credential.year === null ? "" : String(credential.year),
  }
}

/** `null` when a row with content fails validation. */
function toCredentials(rows: Row[]): ExpertCredential[] | null {
  const credentials: ExpertCredential[] = []
  for (const row of rows) {
    const title = row.title.trim()
    const institution = row.institution.trim()
    const year = row.year.trim()
    if (!title && !institution && !year) continue
    const parsed = ExpertCredentialSchema.safeParse({
      title,
      institution: institution || null,
      year: year ? Number(year) : null,
    })
    if (!parsed.success) return null
    credentials.push(parsed.data)
  }
  return credentials
}

export function CredentialsSection({
  initialCredentials,
}: {
  initialCredentials: ExpertCredential[]
}) {
  const t = useTranslations("publicProfile")
  const [rows, setRows] = useState<Row[]>(() => initialCredentials.map(toRow))
  const [isDirty, setIsDirty] = useState(false)
  const { isSaving, save } = useProfileSave()

  function update(rowId: string, patch: Partial<Omit<Row, "rowId">>) {
    setRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    )
    setIsDirty(true)
  }

  function handleSave() {
    const credentials = toCredentials(rows)
    if (!credentials) {
      toast.error(t("credentials.invalid"))
      return
    }
    save({ credentials }, { onSaved: () => setIsDirty(false) })
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle>{t("credentials.title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("credentials.description")}
        </SettingsFieldsetDescription>
        <div className="mt-4 space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("credentials.empty")}
            </p>
          ) : null}
          {rows.map((row) => (
            <div
              key={row.rowId}
              className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem_auto] sm:items-end"
            >
              <div className="space-y-1.5">
                <Label htmlFor={`${row.rowId}-title`}>
                  {t("credentials.itemTitle")}
                </Label>
                <Input
                  id={`${row.rowId}-title`}
                  value={row.title}
                  maxLength={PROFILE_CONTENT_LIMITS.credentialText}
                  placeholder={t("credentials.itemTitlePlaceholder")}
                  disabled={isSaving}
                  onChange={(event) =>
                    update(row.rowId, { title: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${row.rowId}-institution`}>
                  {t("credentials.institution")}
                </Label>
                <Input
                  id={`${row.rowId}-institution`}
                  value={row.institution}
                  maxLength={PROFILE_CONTENT_LIMITS.credentialText}
                  placeholder={t("credentials.institutionPlaceholder")}
                  disabled={isSaving}
                  onChange={(event) =>
                    update(row.rowId, { institution: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${row.rowId}-year`}>
                  {t("credentials.year")}
                </Label>
                <Input
                  id={`${row.rowId}-year`}
                  inputMode="numeric"
                  value={row.year}
                  maxLength={4}
                  disabled={isSaving}
                  onChange={(event) =>
                    update(row.rowId, {
                      year: event.target.value.replace(/\D/gu, ""),
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("credentials.remove")}
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
          ))}
        </div>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        <SettingsFieldsetActions>
          {rows.length < PROFILE_CONTENT_LIMITS.credentials ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              isDisabled={isSaving}
              onPress={() =>
                setRows((current) => [
                  ...current,
                  {
                    rowId: crypto.randomUUID(),
                    title: "",
                    institution: "",
                    year: "",
                  },
                ])
              }
            >
              <PlusIcon className="mr-1.5 size-3.5" />
              {t("credentials.add")}
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
