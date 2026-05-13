"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Camera, Trash2, Loader2 } from "lucide-react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import { Button } from "@eleva/ui/components/button"
import { uploadBlobClient } from "@eleva/storage/blob-upload-client"
import { getAvatarUploadToken, updateAvatar, removeAvatar } from "./actions"

interface AvatarUploadProps {
  currentAvatarUrl: string | null
  displayName: string
  apiBaseUrl: string
}

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp"
const MAX_SIZE_BYTES = 2 * 1024 * 1024

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

export function AvatarUpload({
  currentAvatarUrl,
  displayName,
  apiBaseUrl,
}: AvatarUploadProps) {
  const t = useTranslations("settings")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = React.useState(currentAvatarUrl)
  const [uploading, setUploading] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    if (file.size > MAX_SIZE_BYTES) {
      setError(t("avatar.tooLarge"))
      return
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(t("avatar.invalidType"))
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
        setError(t("avatar.saveFailed"))
        return
      }

      setAvatarUrl(result.url)
    } catch {
      setError(t("avatar.uploadFailed"))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleRemove() {
    setError(null)
    setRemoving(true)
    try {
      const { ok } = await removeAvatar()
      if (!ok) {
        setError(t("avatar.removeFailed"))
        return
      }
      setAvatarUrl(null)
    } catch {
      setError(t("avatar.removeFailed"))
    } finally {
      setRemoving(false)
    }
  }

  const busy = uploading || removing

  return (
    <div className="flex items-start gap-6">
      <div className="relative">
        <Avatar className="size-20">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="text-lg">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="mr-1.5 size-3.5" />
            {t("avatar.upload")}
          </Button>

          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={handleRemove}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              {t("avatar.remove")}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t("avatar.hint")}</p>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleFileSelect}
          aria-label={t("avatar.upload")}
        />
      </div>
    </div>
  )
}
