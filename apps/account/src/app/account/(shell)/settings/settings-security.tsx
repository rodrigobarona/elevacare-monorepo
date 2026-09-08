"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { authClient } from "@eleva/auth/client"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  SettingsFieldset,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"

interface PasskeyRow {
  id: string
  name?: string | null
}

interface SessionRow {
  id: string
  token: string
  userAgent?: string | null
}

export function SettingsSecurity() {
  const t = useTranslations("settings.security")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [totpCode, setTotpCode] = useState("")
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void authClient.passkey
      .listUserPasskeys()
      .then((result) => {
        if (result.data) setPasskeys(result.data as PasskeyRow[])
      })
      .catch(() => setMessage(t("error")))
    void authClient
      .listSessions()
      .then((result) => {
        if (result.data) setSessions(result.data as SessionRow[])
      })
      .catch(() => setMessage(t("error")))
  }, [t])

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
    })
    setMessage(error ? (error.message ?? t("error")) : t("passwordUpdated"))
  }

  async function onEnable2fa() {
    const { data, error } = await authClient.twoFactor.enable({
      password: currentPassword,
    })
    if (error || !data) {
      setMessage(error?.message ?? t("error"))
      return
    }
    const payload = data as { totpURI?: string; backupCodes?: string[] }
    setTotpUri(payload.totpURI ?? null)
    setBackupCodes(payload.backupCodes ?? [])
  }

  async function onVerify2fa(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await authClient.twoFactor.verifyTotp({ code: totpCode })
    setMessage(error ? (error.message ?? t("error")) : t("twoFactorEnabled"))
  }

  async function onAddPasskey() {
    const { error } = await authClient.passkey.addPasskey()
    setMessage(error ? (error.message ?? t("error")) : t("passkeyAdded"))
    const listed = await authClient.passkey.listUserPasskeys()
    if (listed.data) setPasskeys(listed.data as PasskeyRow[])
  }

  async function onRemovePasskey(id: string) {
    const { error } = await authClient.passkey.deletePasskey({ id })
    if (error) {
      setMessage(error.message ?? t("error"))
      return
    }
    setPasskeys((rows) => rows.filter((row) => row.id !== id))
  }

  async function onRevokeSession(session: SessionRow) {
    const { error } = await authClient.revokeSession({ token: session.token })
    if (error) {
      setMessage(error.message ?? t("error"))
      return
    }
    setSessions((rows) => rows.filter((row) => row.id !== session.id))
  }

  return (
    <div className="space-y-6">
      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("description")}
          </SettingsFieldsetDescription>
          <form className="mt-4 space-y-3" onSubmit={onChangePassword}>
            <div className="space-y-1.5">
              <Label htmlFor="current-password">{t("currentPassword")}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">{t("newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" size="sm">
              {t("updatePassword")}
            </Button>
          </form>
          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium">{t("twoFactor")}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onPress={onEnable2fa}
            >
              {t("enableTwoFactor")}
            </Button>
            {totpUri ? (
              <p className="text-xs break-all text-muted-foreground">
                {totpUri}
              </p>
            ) : null}
            {backupCodes.length > 0 ? (
              <ul className="list-disc pl-5 text-sm">
                {backupCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            ) : null}
            {totpUri ? (
              <form className="space-y-2" onSubmit={onVerify2fa}>
                <Label htmlFor="totp">{t("totpCode")}</Label>
                <Input
                  id="totp"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                />
                <Button type="submit" size="sm">
                  {t("verify")}
                </Button>
              </form>
            ) : null}
          </div>
          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium">{t("passkeys")}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onPress={onAddPasskey}
            >
              {t("addPasskey")}
            </Button>
            <ul className="space-y-2">
              {passkeys.map((passkey) => (
                <li
                  key={passkey.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{passkey.name ?? passkey.id}</span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onPress={() => void onRemovePasskey(passkey.id)}
                  >
                    {t("remove")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          {message ? (
            <p className="mt-4 text-sm text-muted-foreground">{message}</p>
          ) : null}
        </SettingsFieldsetContent>
      </SettingsFieldset>

      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("sessionsTitle")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("sessionsDescription")}
          </SettingsFieldsetDescription>
          <ul className="mt-4 space-y-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate">
                  {session.userAgent ?? session.id}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onPress={() => void onRevokeSession(session)}
                >
                  {t("revoke")}
                </Button>
              </li>
            ))}
          </ul>
        </SettingsFieldsetContent>
      </SettingsFieldset>
    </div>
  )
}
