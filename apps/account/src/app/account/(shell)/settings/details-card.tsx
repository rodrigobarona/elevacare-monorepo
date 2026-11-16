"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { AVATAR_UPLOAD } from "@eleva/config/avatar-upload"
import { Loader2 } from "@eleva/icons"
import { uploadFile } from "@eleva/storage/upload-client"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import { Button } from "@eleva/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@eleva/ui/components/field"
import { Input } from "@eleva/ui/components/input"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import {
  getAvatarFallbackStyle,
  getAvatarInitials,
  getAvatarSeed,
} from "@eleva/ui/lib/avatar-utils"
import {
  getAvatarUploadToken,
  removeAvatar,
  updateAvatar,
  updateDetails,
} from "./actions"

const ACCEPTED_TYPES: readonly string[] = AVATAR_UPLOAD.contentTypes

interface DetailsCardProps {
  name: string
  email: string
  avatarUrl: string | null
  apiBaseUrl: string
}

/** Photo, name and sign-in email: what experts see when you book. */
export function DetailsCard({
  name: initialName,
  email,
  avatarUrl: initialAvatarUrl,
  apiBaseUrl,
}: DetailsCardProps) {
  const t = useTranslations("profile")
  const router = useRouter()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [name, setName] = React.useState(initialName)
  const [avatarUrl, setAvatarUrl] = React.useState(initialAvatarUrl)
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)
  const photoBusy = uploading || removing
  const seed = getAvatarSeed(email, initialName)

  async function onPickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > AVATAR_UPLOAD.maxBytes) {
      toast.error(t("avatar.tooLarge"))
      return
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t("avatar.invalidType"))
      return
    }
    setUploading(true)
    try {
      const uploadToken = await getAvatarUploadToken()
      const result = await uploadFile({
        prefix: AVATAR_UPLOAD.prefix,
        kind: AVATAR_UPLOAD.kind,
        file,
        apiUploadUrl: `${apiBaseUrl}/storage/upload`,
        headers: { Authorization: `Bearer ${uploadToken}` },
      })
      const { ok } = await updateAvatar(result.url).catch(() => ({ ok: false }))
      if (!ok) {
        toast.error(t("avatar.saveFailed"))
        return
      }
      setAvatarUrl(result.url)
      toast.success(t("avatar.uploaded"))
      router.refresh()
    } catch {
      toast.error(t("avatar.uploadFailed"))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function onRemovePhoto() {
    setRemoving(true)
    try {
      const { ok } = await removeAvatar().catch(() => ({ ok: false }))
      if (!ok) {
        toast.error(t("avatar.removeFailed"))
        return
      }
      setAvatarUrl(null)
      toast.success(t("avatar.removed"))
      router.refresh()
    } finally {
      setRemoving(false)
    }
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const { ok } = await updateDetails({ name: name.trim() }).catch(() => ({
        ok: false,
      }))
      if (!ok) {
        toast.error(t("details.error"))
        return
      }
      toast.success(t("details.saved"))
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsFieldset>
      <form onSubmit={onSave} data-testid="profile-details">
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle as="h2">
            {t("details.title")}
          </SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("details.description")}
          </SettingsFieldsetDescription>

          <FieldGroup className="mt-6 gap-6">
            <Field>
              <span className="text-sm font-medium">{t("details.photo")}</span>
              <div className="flex items-center gap-4">
                <Avatar key={avatarUrl ?? "initials"} className="size-16">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                  <AvatarFallback
                    className="text-xl font-semibold text-white"
                    style={getAvatarFallbackStyle(seed)}
                  >
                    {getAvatarInitials(initialName, email)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      isDisabled={photoBusy}
                      onPress={() => fileInputRef.current?.click()}
                      data-testid="profile-photo-upload"
                    >
                      {uploading ? (
                        <Loader2 className="animate-spin" aria-hidden />
                      ) : null}
                      {avatarUrl
                        ? t("details.changePhoto")
                        : t("details.uploadPhoto")}
                    </Button>
                    {avatarUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        isDisabled={photoBusy}
                        onPress={() => void onRemovePhoto()}
                      >
                        {t("details.removePhoto")}
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("details.photoHint")}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden
                  onChange={onPickPhoto}
                />
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-name">
                {t("details.name")}
              </FieldLabel>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={200}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-email">
                {t("details.email")}
              </FieldLabel>
              <Input
                id="profile-email"
                value={email}
                readOnly
                aria-describedby="profile-email-hint"
                className="bg-muted/50 text-muted-foreground"
              />
              <FieldDescription id="profile-email-hint">
                {t("details.emailHint")}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </SettingsFieldsetContent>
        <SettingsFieldsetFooter className="sm:justify-end">
          <SettingsFieldsetActions>
            <Button
              type="submit"
              size="sm"
              isDisabled={saving || name.trim() === initialName}
            >
              {saving ? t("details.saving") : t("details.save")}
            </Button>
          </SettingsFieldsetActions>
        </SettingsFieldsetFooter>
      </form>
    </SettingsFieldset>
  )
}
