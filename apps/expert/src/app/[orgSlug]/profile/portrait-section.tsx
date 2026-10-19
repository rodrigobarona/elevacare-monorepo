"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { EXPERT_PORTRAIT_UPLOAD } from "@eleva/config/expert-profile-content"
import { CameraIcon, CheckIcon, Loader2, Trash2, XIcon } from "@eleva/icons"
import { uploadBlobClient } from "@eleva/storage/blob-upload-client"
import { ExpertPortrait } from "@eleva/ui/blocks/expert-portrait"
import { Button } from "@eleva/ui/components/button"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetStatus,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { getPortraitUploadToken } from "./actions"
import { useProfileSave } from "./use-profile-save"

const ACCEPTED_TYPES: readonly string[] = EXPERT_PORTRAIT_UPLOAD.contentTypes

export function PortraitSection({
  initialUrl,
  displayName,
  username,
  apiBaseUrl,
}: {
  initialUrl: string | null
  displayName: string
  username: string
  apiBaseUrl: string
}) {
  const t = useTranslations("publicProfile.portrait")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(initialUrl)
  const [isUploading, setIsUploading] = useState(false)
  const { isSaving, save } = useProfileSave()
  const isBusy = isUploading || isSaving

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t("invalidType"))
      return
    }
    if (file.size > EXPERT_PORTRAIT_UPLOAD.maxBytes) {
      toast.error(t("tooLarge"))
      return
    }

    setIsUploading(true)
    try {
      const token = await getPortraitUploadToken()
      const uploaded = await uploadBlobClient({
        prefix: EXPERT_PORTRAIT_UPLOAD.prefix,
        kind: EXPERT_PORTRAIT_UPLOAD.kind,
        file,
        handleUploadUrl: `${apiBaseUrl}/blob/upload`,
        headers: { Authorization: `Bearer ${token}` },
      })
      save(
        { avatarUrl: uploaded.url },
        { success: t("uploaded"), onSaved: () => setUrl(uploaded.url) }
      )
    } catch {
      toast.error(t("uploadFailed"))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle>{t("title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("description")}
        </SettingsFieldsetDescription>
        <div className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
          <button
            type="button"
            className="group relative aspect-[4/5] w-full max-w-48 cursor-pointer overflow-hidden rounded-3xl bg-muted shadow-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            aria-label={url ? t("replace") : t("upload")}
          >
            <ExpertPortrait
              key={url ?? "initials"}
              displayName={displayName}
              username={username}
              avatarUrl={url}
              className={url ? undefined : "text-4xl"}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors group-hover:bg-foreground/40 group-focus-visible:bg-foreground/40">
              {isBusy ? (
                <Loader2 className="size-6 animate-spin text-primary-foreground" />
              ) : (
                <CameraIcon className="size-6 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
              )}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={handleFile}
            aria-label={url ? t("replace") : t("upload")}
          />
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <TipList
              title={t("doTitle")}
              items={t.raw("do") as string[]}
              tone="do"
            />
            <TipList
              title={t("avoidTitle")}
              items={t.raw("avoid") as string[]}
              tone="avoid"
            />
          </div>
        </div>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        <SettingsFieldsetStatus>
          {isUploading ? t("uploading") : t("hint")}
        </SettingsFieldsetStatus>
        <SettingsFieldsetActions>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              isDisabled={isBusy}
              onPress={() =>
                save(
                  { avatarUrl: null },
                  { success: t("removed"), onSaved: () => setUrl(null) }
                )
              }
            >
              <Trash2 className="mr-1.5 size-3.5" />
              {t("remove")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            isDisabled={isBusy}
            onPress={() => fileInputRef.current?.click()}
          >
            {url ? t("replace") : t("upload")}
          </Button>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}

function TipList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: "do" | "avoid"
}) {
  const Icon = tone === "do" ? CheckIcon : XIcon
  return (
    <div className="space-y-2">
      <p className="font-medium">{title}</p>
      <ul className="space-y-1.5 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Icon
              aria-hidden
              className={
                tone === "do"
                  ? "mt-0.5 size-4 shrink-0 text-teal-600"
                  : "mt-0.5 size-4 shrink-0 text-muted-foreground"
              }
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
