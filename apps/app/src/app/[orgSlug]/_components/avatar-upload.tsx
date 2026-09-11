"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { CameraIcon, CircleNotchIcon, TrashIcon } from "@eleva/icons"
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
import {
  getAvatarUploadToken,
  removeAvatarAction,
  updateAvatarAction,
} from "../actions"

interface AvatarUploadProps {
  orgSlug: string
  currentAvatarUrl: string | null
  displayName: string
  email: string
  apiBaseUrl: string
}

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp"
const MAX_SIZE_BYTES = 2 * 1024 * 1024

export function AvatarUpload({
  orgSlug,
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
  const busy = uploading || removing

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
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

      const saved = await updateAvatarAction(orgSlug, result.url)
      if (!saved.ok) {
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
      const result = await removeAvatarAction(orgSlug)
      if (!result.ok) {
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

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent layout="avatar">
        <SettingsFieldsetAvatarSlot>
          <Button
            type="button"
            variant="ghost"
            className="relative size-20 rounded-full p-0"
            isDisabled={busy}
            onPress={() => fileInputRef.current?.click()}
            aria-label={t("avatar.changePhoto")}
          >
            <Avatar key={avatarUrl ?? "fallback"} className="size-20">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={displayName} />
              ) : null}
              <AvatarFallback
                className="text-3xl leading-none font-semibold text-white"
                style={fallbackStyle}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {!uploading ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 transition-colors group-hover/button:bg-foreground/40">
                <CameraIcon className="size-5 text-primary-foreground opacity-0 transition-opacity group-hover/button:opacity-100" />
              </span>
            ) : (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
                <CircleNotchIcon className="size-5 animate-spin text-muted-foreground" />
              </span>
            )}
          </Button>
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
              isDisabled={busy}
              onPress={handleRemove}
            >
              <TrashIcon className="mr-1.5 size-3.5" />
              {t("avatar.remove")}
            </Button>
          </SettingsFieldsetActions>
        ) : null}
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}
