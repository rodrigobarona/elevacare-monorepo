"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useFormatter, useTranslations } from "next-intl"
import { toast } from "sonner"
import { authClient } from "@eleva/auth/client"
import { describeUserAgent } from "@eleva/auth/user-agent"
import { DeviceMobileIcon, MonitorIcon } from "@eleva/icons"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import { Button } from "@eleva/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@eleva/ui/components/field"
import { InfoPopover } from "@eleva/ui/components/info-popover"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { Input } from "@eleva/ui/components/input"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetTitle,
  SettingsRow,
} from "@eleva/ui/components/settings-fieldset"
import { authErrorKey } from "./auth-error"
import { TwoStepDialog } from "./two-step-dialog"

interface PasskeyRow {
  id: string
  name?: string | null
  createdAt?: string | Date | null
}

interface SessionRow {
  id: string
  token: string
  userAgent?: string | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

const GOOGLE_LINK_PARAM = "google"
const DEVICES_SHOWN = 5

/** Better Auth OAuth callback `?error=` code → the matching message. */
function googleLinkErrorKey(code: string | null) {
  if (code === "email_does_not_match") return "linkEmailMismatch"
  if (code === "account_already_linked_to_different_user") return "linkTaken"
  return "linkFailed"
}

export function SecurityPanel() {
  const t = useTranslations("security")
  const searchParams = useSearchParams()
  const [providers, setProviders] = useState<string[] | null>(null)
  const [currentToken, setCurrentToken] = useState<string | null>(null)
  const [twoStepOn, setTwoStepOn] = useState(false)
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])

  useEffect(() => {
    // A failed Google link comes back here with ?google=failed&error=…
    if (searchParams.get(GOOGLE_LINK_PARAM) === "failed") {
      toast.error(t(`google.${googleLinkErrorKey(searchParams.get("error"))}`))
      const url = new URL(window.location.href)
      for (const param of [GOOGLE_LINK_PARAM, "error", "error_description"]) {
        url.searchParams.delete(param)
      }
      window.history.replaceState(window.history.state, "", url)
    }
    let cancelled = false
    Promise.all([
      authClient.listAccounts(),
      authClient.getSession(),
      authClient.passkey.listUserPasskeys(),
      authClient.listSessions(),
    ])
      .then(([accounts, current, passkeyList, sessionList]) => {
        if (cancelled) return
        if (accounts.error) toast.error(t("error"))
        setProviders(accounts.data?.map((account) => account.providerId) ?? [])
        setCurrentToken(current.data?.session.token ?? null)
        setTwoStepOn(Boolean(current.data?.user.twoFactorEnabled))
        setPasskeys((passkeyList.data as PasskeyRow[] | undefined) ?? [])
        setSessions((sessionList.data as SessionRow[] | undefined) ?? [])
      })
      .catch(() => toast.error(t("error")))
    return () => {
      cancelled = true
    }
  }, [searchParams, t])

  const hasPassword = providers?.includes("credential") ?? false

  return (
    <div className="space-y-6">
      <PasswordCard loading={providers === null} hasPassword={hasPassword} />
      {/* Two-step verification adds a code after a password; without one
          (Google or email link sign-in) there is nothing to add it to. */}
      {hasPassword ? (
        <TwoStepCard isOn={twoStepOn} onChange={setTwoStepOn} />
      ) : null}
      <PasskeysCard passkeys={passkeys} onChange={setPasskeys} />
      <GoogleCard
        loading={providers === null}
        connected={providers?.includes("google") ?? false}
      />
      <DevicesCard
        sessions={sessions}
        currentToken={currentToken}
        onChange={setSessions}
      />
    </div>
  )
}

function PasswordCard({
  loading,
  hasPassword,
}: {
  loading: boolean
  hasPassword: boolean
}) {
  const t = useTranslations("security")
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      // A new password is often the answer to a stolen one: sign out
      // every other device too (said under the field).
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      })
      if (error) {
        toast.error(t(authErrorKey(error)))
        return
      }
      setCurrent("")
      setNext("")
      toast.success(t("password.saved"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsFieldset data-testid="security-password">
      <form onSubmit={onSubmit}>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle as="h2">
            {t("password.title")}
          </SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {loading || hasPassword
              ? t("password.description")
              : t("password.none")}
          </SettingsFieldsetDescription>
          {hasPassword ? (
            <FieldGroup className="mt-6 gap-5">
              <Field>
                <FieldLabel htmlFor="current-password">
                  {t("password.current")}
                </FieldLabel>
                <Input
                  id="current-password"
                  type="password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-password">
                  {t("password.new")}
                </FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  aria-describedby="new-password-hint"
                  required
                />
                <FieldDescription id="new-password-hint">
                  {t("password.newHint")} {t("password.signOutOthers")}
                </FieldDescription>
              </Field>
            </FieldGroup>
          ) : null}
        </SettingsFieldsetContent>
        {hasPassword ? (
          <SettingsFieldsetFooter className="sm:justify-end">
            <SettingsFieldsetActions>
              <Button
                type="submit"
                size="sm"
                isDisabled={saving || !current || next.length < 8}
              >
                {saving ? t("password.saving") : t("password.submit")}
              </Button>
            </SettingsFieldsetActions>
          </SettingsFieldsetFooter>
        ) : null}
      </form>
    </SettingsFieldset>
  )
}

function TwoStepCard({
  isOn,
  onChange,
}: {
  isOn: boolean
  onChange: (on: boolean) => void
}) {
  const t = useTranslations("security.twoStep")
  const [dialog, setDialog] = useState<"on" | "off" | null>(null)

  return (
    <SettingsFieldset data-testid="security-two-step">
      <SettingsFieldsetContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SettingsFieldsetTitle as="h2">{t("title")}</SettingsFieldsetTitle>
            <InfoPopover label={t("infoLabel")}>
              <p>{t("info")}</p>
            </InfoPopover>
          </div>
          <SettingsFieldsetDescription>
            {t("description")}
          </SettingsFieldsetDescription>
        </div>
        <span className="self-start">
          <StatusPill tone={isOn ? "positive" : "neutral"}>
            {isOn ? t("on") : t("off")}
          </StatusPill>
        </span>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter className="sm:justify-end">
        <SettingsFieldsetActions>
          <Button
            size="sm"
            variant="outline"
            onPress={() => setDialog(isOn ? "off" : "on")}
          >
            {isOn ? t("turnOff") : t("turnOn")}
          </Button>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
      <TwoStepDialog
        key={dialog ?? "closed"}
        mode={dialog}
        onClose={() => setDialog(null)}
        onDone={(on) => {
          onChange(on)
          setDialog(null)
        }}
      />
    </SettingsFieldset>
  )
}

function PasskeysCard({
  passkeys,
  onChange,
}: {
  passkeys: PasskeyRow[]
  onChange: (rows: PasskeyRow[]) => void
}) {
  const t = useTranslations("security.passkeys")
  const tSecurity = useTranslations("security")
  const format = useFormatter()
  const [busy, setBusy] = useState(false)

  async function onAdd() {
    setBusy(true)
    try {
      const { error } = await authClient.passkey.addPasskey()
      if (error) {
        // Closing the browser prompt is not an error worth a toast.
        if (error.code !== "ERROR_CEREMONY_ABORTED") {
          toast.error(tSecurity("error"))
        }
        return
      }
      const listed = await authClient.passkey.listUserPasskeys()
      onChange((listed.data as PasskeyRow[] | undefined) ?? [])
      toast.success(t("added"))
    } finally {
      setBusy(false)
    }
  }

  const [removing, setRemoving] = useState<PasskeyRow | null>(null)

  async function onRemove(id: string) {
    setBusy(true)
    try {
      const { error } = await authClient.passkey.deletePasskey({ id })
      if (error) {
        toast.error(tSecurity("error"))
        return
      }
      onChange(passkeys.filter((row) => row.id !== id))
      setRemoving(null)
      toast.success(t("removed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsFieldset data-testid="security-passkeys">
      <SettingsFieldsetContent>
        <div className="flex items-center gap-2">
          <SettingsFieldsetTitle as="h2">{t("title")}</SettingsFieldsetTitle>
          <InfoPopover label={t("infoLabel")}>
            <p>{t("info")}</p>
          </InfoPopover>
        </div>
        <SettingsFieldsetDescription>
          {t("description")}
        </SettingsFieldsetDescription>
        <div className="mt-6" data-testid="settings-passkeys">
          {passkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            passkeys.map((passkey) => (
              <SettingsRow
                key={passkey.id}
                className="items-center"
                title={passkey.name || t("unnamed")}
                meta={
                  passkey.createdAt
                    ? t("addedOn", {
                        date: format.dateTime(new Date(passkey.createdAt), {
                          dateStyle: "medium",
                        }),
                      })
                    : null
                }
              >
                <Button
                  size="sm"
                  variant="ghost"
                  className="-mr-3"
                  isDisabled={busy}
                  onPress={() => setRemoving(passkey)}
                >
                  {t("remove")}
                </Button>
              </SettingsRow>
            ))
          )}
        </div>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter className="sm:justify-end">
        <SettingsFieldsetActions>
          <Button
            size="sm"
            variant="outline"
            isDisabled={busy}
            onPress={() => void onAdd()}
            data-testid="settings-add-passkey"
          >
            {t("add")}
          </Button>
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
      <AlertDialog
        isOpen={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("removeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("removeBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel isDisabled={busy}>{t("cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            isDisabled={busy}
            onPress={() => removing && void onRemove(removing.id)}
          >
            {t("remove")}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </SettingsFieldset>
  )
}

function GoogleCard({
  loading,
  connected,
}: {
  loading: boolean
  connected: boolean
}) {
  const t = useTranslations("security.google")

  async function onConnect() {
    const failed = new URL(window.location.href)
    failed.searchParams.set(GOOGLE_LINK_PARAM, "failed")
    try {
      const { data, error } = await authClient.linkSocial({
        provider: "google",
        callbackURL: window.location.href,
        errorCallbackURL: failed.toString(),
      })
      if (error || !data?.url) {
        toast.error(error?.message ?? t("linkFailed"))
        return
      }
      window.location.assign(data.url)
    } catch {
      toast.error(t("linkFailed"))
    }
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SettingsFieldsetTitle as="h2">{t("title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("description")}
          </SettingsFieldsetDescription>
        </div>
        {connected ? (
          <span data-testid="settings-google-linked" className="self-start">
            <StatusPill tone="positive">{t("connected")}</StatusPill>
          </span>
        ) : null}
      </SettingsFieldsetContent>
      {loading || connected ? null : (
        <SettingsFieldsetFooter className="sm:justify-end">
          <SettingsFieldsetActions>
            <Button
              size="sm"
              variant="outline"
              onPress={() => void onConnect()}
              data-testid="settings-connect-google"
            >
              {t("connect")}
            </Button>
          </SettingsFieldsetActions>
        </SettingsFieldsetFooter>
      )}
    </SettingsFieldset>
  )
}

function DevicesCard({
  sessions,
  currentToken,
  onChange,
}: {
  sessions: SessionRow[]
  currentToken: string | null
  onChange: (rows: SessionRow[]) => void
}) {
  const t = useTranslations("security.devices")
  const tSecurity = useTranslations("security")
  const format = useFormatter()
  const [busy, setBusy] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // This device first, then the most recently active.
  const sorted = [...sessions].sort((a, b) => {
    if (a.token === currentToken) return -1
    if (b.token === currentToken) return 1
    const at = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
    const bt = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime()
    return bt - at
  })
  const shown = showAll ? sorted : sorted.slice(0, DEVICES_SHOWN)
  const others = sessions.filter((row) => row.token !== currentToken)

  function deviceName(userAgent: string | null | undefined): string {
    const { browser, os } = describeUserAgent(userAgent)
    if (browser && os) return t("name", { browser, os })
    return browser ?? os ?? t("unknown")
  }

  async function onSignOut(row: SessionRow) {
    setBusy(true)
    try {
      const { error } = await authClient.revokeSession({ token: row.token })
      if (error) {
        toast.error(tSecurity("error"))
        return
      }
      onChange(sessions.filter((item) => item.id !== row.id))
      toast.success(t("signedOut"))
    } finally {
      setBusy(false)
    }
  }

  async function onSignOutOthers() {
    setBusy(true)
    try {
      const { error } = await authClient.revokeOtherSessions()
      if (error) {
        toast.error(tSecurity("error"))
        return
      }
      onChange(sessions.filter((item) => item.token === currentToken))
      toast.success(t("signedOutOthers"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsFieldset data-testid="security-devices">
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle as="h2">{t("title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("description")}
        </SettingsFieldsetDescription>
        <div className="mt-6">
          {shown.map((row) => {
            const isCurrent = row.token === currentToken
            const { kind } = describeUserAgent(row.userAgent)
            const DeviceIcon =
              kind === "computer" ? MonitorIcon : DeviceMobileIcon
            const lastActive = row.updatedAt ?? row.createdAt
            return (
              <SettingsRow
                key={row.id}
                className="items-center"
                title={
                  <span className="flex items-center gap-2">
                    <DeviceIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                    {deviceName(row.userAgent)}
                    {isCurrent ? (
                      <StatusPill tone="positive">{t("thisDevice")}</StatusPill>
                    ) : null}
                  </span>
                }
                meta={
                  lastActive && !isCurrent
                    ? t("lastActive", {
                        date: format.relativeTime(new Date(lastActive)),
                      })
                    : null
                }
              >
                {isCurrent ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="-mr-3"
                    isDisabled={busy}
                    onPress={() => void onSignOut(row)}
                  >
                    {t("signOut")}
                  </Button>
                )}
              </SettingsRow>
            )
          })}
        </div>
        {sorted.length > DEVICES_SHOWN ? (
          <Button
            variant="link"
            size="sm"
            className="mt-3 px-0"
            onPress={() => setShowAll((value) => !value)}
          >
            {showAll ? t("showFewer") : t("showAll", { count: sorted.length })}
          </Button>
        ) : null}
      </SettingsFieldsetContent>
      {others.length > 0 ? (
        <SettingsFieldsetFooter className="sm:justify-end">
          <SettingsFieldsetActions>
            <Button
              size="sm"
              variant="outline"
              isDisabled={busy}
              onPress={() => void onSignOutOthers()}
            >
              {t("signOutOthers")}
            </Button>
          </SettingsFieldsetActions>
        </SettingsFieldsetFooter>
      ) : null}
    </SettingsFieldset>
  )
}
