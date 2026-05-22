"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { CameraIcon, Trash2, Loader2 } from "@eleva/icons"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import { Button } from "@eleva/ui/components/button"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetAvatarSlot,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetStatus,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import { uploadBlobClient } from "@eleva/storage/blob-upload-client"
import { toast } from "sonner"
import {
  getAvatarFallbackStyle,
  getAvatarInitials,
  getAvatarSeed,
} from "@eleva/ui/lib/avatar-utils"
import { getAvatarUploadToken, updateAvatar, removeAvatar } from "./actions"

interface AvatarUploadProps {
  currentAvatarUrl: string | null
  displayName: string
  email: string
  apiBaseUrl: string
}

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp"
const MAX_SIZE_BYTES = 2 * 1024 * 1024

export function AvatarUpload({
  currentAvatarUrl,
  displayName,
  email,
  apiBaseUrl,
}: AvatarUploadProps) {
  const t = useTranslations("settings")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = React.useState(currentAvatarUrl)
  const [uploading, setUploading] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)
  const avatarSeed = getAvatarSeed(email, displayName)
  const initials = getAvatarInitials(displayName, email)
  const fallbackStyle = getAvatarFallbackStyle(avatarSeed)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_SIZE_BYTES) {
      toast.error(t("avatar.tooLarge"))
      return
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error(t("avatar.invalidType"))
      return
    }

    setUploading(true)
    try {
      const uploadToken = await getAvatarUploadToken()
      const result = await uploadBlobClient({
        prefix: "avatar",
        kind: "profile",
        file,
        handleUploadUrl: `${apiBaseUrl}/blob/upload`,
        headers: { Authorization: `Bearer ${uploadToken}` },
      })

      const { ok } = await updateAvatar(result.url)
      if (!ok) {
        toast.error(t("avatar.saveFailed"))
        return
      }

      setAvatarUrl(result.url)
      toast.success(t("avatar.uploaded"))
    } catch {
      toast.error(t("avatar.uploadFailed"))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      const { ok } = await removeAvatar()
      if (!ok) {
        toast.error(t("avatar.removeFailed"))
        return
      }
      setAvatarUrl(null)
      toast.success(t("avatar.removed"))
    } catch {
      toast.error(t("avatar.removeFailed"))
    } finally {
      setRemoving(false)
    }
  }

  const busy = uploading || removing

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent layout="avatar">
        <SettingsFieldsetAvatarSlot>
          <button
            type="button"
            className="group relative cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            aria-label={t("avatar.changePhoto")}
          >
            <Avatar key={avatarUrl ?? "fallback"} className="size-20">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={displayName} />
              ) : null}
              <AvatarFallback
                delayMs={0}
                className="text-3xl leading-none font-semibold text-white"
                style={fallbackStyle}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {!uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 transition-colors group-hover:bg-foreground/40 group-focus-visible:bg-foreground/40">
                <CameraIcon className="size-5 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleFileSelect}
            aria-label={t("avatar.changePhoto")}
          />
        </SettingsFieldsetAvatarSlot>

        <SettingsFieldsetTitle>{t("avatar.title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("avatar.description")}
        </SettingsFieldsetDescription>
      </SettingsFieldsetContent>

      <SettingsFieldsetFooter>
        <SettingsFieldsetStatus>{t("avatar.hint")}</SettingsFieldsetStatus>
        {avatarUrl ? (
          <SettingsFieldsetActions>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              disabled={busy}
              onClick={handleRemove}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              {t("avatar.remove")}
            </Button>
          </SettingsFieldsetActions>
        ) : null}
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
