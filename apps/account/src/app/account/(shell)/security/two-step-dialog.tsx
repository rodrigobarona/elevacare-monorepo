"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { encode } from "uqr"
import { authClient } from "@eleva/auth/client"
import { ArrowLeftIcon, DownloadSimpleIcon } from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@eleva/ui/components/dialog"
import { Field, FieldLabel } from "@eleva/ui/components/field"
import { Input } from "@eleva/ui/components/input"
import { authErrorKey } from "./auth-error"

type Mode = "on" | "off"
type Step = "password" | "scan" | "code" | "backup"

const STEPS: Step[] = ["password", "scan", "code", "backup"]

interface Setup {
  uri: string
  secret: string
  backupCodes: string[]
}

function setupFrom(data: unknown): Setup | null {
  const payload = data as { totpURI?: string; backupCodes?: string[] }
  if (!payload?.totpURI) return null
  try {
    const secret = new URL(payload.totpURI).searchParams.get("secret")
    if (!secret) return null
    return {
      uri: payload.totpURI,
      secret,
      backupCodes: payload.backupCodes ?? [],
    }
  } catch {
    return null
  }
}

/** The otpauth URI as an SVG QR code (dark modules on white, any theme). */
function QrCode({ value, label }: { value: string; label: string }) {
  const { data, size } = useMemo(() => encode(value, { border: 2 }), [value])
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      className="size-52 rounded-2xl border border-border bg-white p-2"
      shapeRendering="crispEdges"
    >
      {data.flatMap((row, y) =>
        row.map((dark, x) =>
          dark ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />
          ) : null
        )
      )}
    </svg>
  )
}

/**
 * Turning two-step verification on takes four short steps, one goal each
 * (pattern: Deel, Braintrust in `_context/mobbin/library/12-account-settings`):
 * confirm the password, scan the code (or copy the key; on a phone, open
 * the app), enter the code, then download or copy the backup codes, shown
 * once setup has worked; Done unlocks after they are saved. Turning it
 * off asks for the password only. The parent remounts it per opening
 * (`key`), so each opening starts empty.
 */
export function TwoStepDialog({
  mode,
  onClose,
  onDone,
}: {
  mode: Mode | null
  onClose: () => void
  onDone: (on: boolean) => void
}) {
  const t = useTranslations("security.twoStep")
  const tSecurity = useTranslations("security")
  const [step, setStep] = useState<Step>("password")
  const [password, setPassword] = useState("")
  const [setup, setSetup] = useState<Setup | null>(null)
  const [code, setCode] = useState("")
  const [savedCodes, setSavedCodes] = useState(false)
  const [busy, setBusy] = useState(false)
  const hasBackupCodes = (setup?.backupCodes.length ?? 0) > 0
  const steps = hasBackupCodes ? STEPS : STEPS.slice(0, 3)
  const stepNumber = steps.indexOf(step) + 1

  async function onPassword(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      if (mode === "off") {
        const { error } = await authClient.twoFactor.disable({ password })
        if (error) {
          toast.error(tSecurity(authErrorKey(error)))
          return
        }
        toast.success(t("disabled"))
        onDone(false)
        return
      }
      // A setup made earlier in this opening is reused when going back.
      if (!setup) {
        const { data, error } = await authClient.twoFactor.enable({ password })
        const next = setupFrom(data)
        if (error || !next) {
          toast.error(tSecurity(authErrorKey(error)))
          return
        }
        setSetup(next)
      }
      setStep("scan")
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: code.trim(),
      })
      if (error) {
        toast.error(tSecurity(authErrorKey(error)))
        return
      }
      if (hasBackupCodes) {
        setStep("backup")
        return
      }
      toast.success(t("enabled"))
      onDone(true)
    } finally {
      setBusy(false)
    }
  }

  async function copy(text: string, done: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(done)
      return true
    } catch {
      toast.error(tSecurity("error"))
      return false
    }
  }

  /** A plain text file she can keep in her password manager or print. */
  function downloadCodes(current: Setup) {
    const text = [
      t("backupStep.fileHeader"),
      "",
      ...current.backupCodes,
      "",
    ].join("\n")
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "eleva-backup-codes.txt"
    link.click()
    URL.revokeObjectURL(url)
    setSavedCodes(true)
  }

  const stepCount =
    mode === "on" ? (
      <p className="text-xs text-muted-foreground sm:mr-auto sm:self-center">
        {t("stepCount", { current: stepNumber, total: steps.length })}
      </p>
    ) : null

  const backButton = (to: Step) => (
    <Button
      type="button"
      variant="outline"
      isDisabled={busy}
      onPress={() => setStep(to)}
    >
      <ArrowLeftIcon aria-hidden data-icon="inline-start" />
      {t("back")}
    </Button>
  )

  return (
    <Dialog
      isOpen={mode !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      // Once two-step is on, the codes must not be lost to a stray click.
      isDismissable={step !== "backup" && !busy}
      showCloseButton={step !== "backup" && !busy}
    >
      {step === "password" ? (
        <form onSubmit={onPassword} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>
              {mode === "off"
                ? t("turnOffStep.title")
                : t("passwordStep.title")}
            </DialogTitle>
            <DialogDescription>
              {mode === "off"
                ? t("turnOffStep.description")
                : t("passwordStep.description")}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="two-step-password">
              {t("passwordStep.password")}
            </FieldLabel>
            <Input
              id="two-step-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <DialogFooter>
            {stepCount}
            <Button type="button" variant="outline" onPress={onClose}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant={mode === "off" ? "destructive" : "default"}
              isDisabled={busy || !password}
            >
              {mode === "off"
                ? t("turnOffStep.confirm")
                : t("passwordStep.continue")}
            </Button>
          </DialogFooter>
        </form>
      ) : null}

      {step === "scan" && setup ? (
        <div className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{t("scanStep.title")}</DialogTitle>
            <DialogDescription>{t("scanStep.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <QrCode value={setup.uri} label={t("scanStep.qrLabel")} />
            <Button
              type="button"
              variant="link"
              size="sm"
              onPress={() => void copy(setup.secret, t("scanStep.copied"))}
            >
              {t("scanStep.copyKey")}
            </Button>
            {/* A phone cannot scan its own screen: the otpauth link opens
                the authenticator app there instead. */}
            <LinkButton
              href={setup.uri}
              size="sm"
              variant="outline"
              className="sm:hidden"
            >
              {t("scanStep.openInApp")}
            </LinkButton>
          </div>
          <DialogFooter>
            {stepCount}
            {backButton("password")}
            <Button type="button" onPress={() => setStep("code")}>
              {t("next")}
            </Button>
          </DialogFooter>
        </div>
      ) : null}

      {step === "code" ? (
        <form onSubmit={onVerify} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{t("codeStep.title")}</DialogTitle>
            <DialogDescription>{t("codeStep.description")}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="two-step-code">
              {t("codeStep.code")}
            </FieldLabel>
            <Input
              id="two-step-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              className="text-center font-mono text-lg tracking-[0.5em]"
              autoFocus
              required
            />
          </Field>
          <DialogFooter>
            {stepCount}
            {backButton("scan")}
            <Button type="submit" isDisabled={busy || code.trim().length !== 6}>
              {t("codeStep.verify")}
            </Button>
          </DialogFooter>
        </form>
      ) : null}

      {step === "backup" && setup ? (
        <div className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{t("backupStep.title")}</DialogTitle>
            <DialogDescription>{t("backupStep.description")}</DialogDescription>
          </DialogHeader>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl bg-muted p-4 font-mono text-sm">
            {setup.backupCodes.map((backup) => (
              <li key={backup}>{backup}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onPress={() => downloadCodes(setup)}>
              <DownloadSimpleIcon aria-hidden data-icon="inline-start" />
              {t("backupStep.download")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onPress={async () => {
                const copied = await copy(
                  setup.backupCodes.join("\n"),
                  t("backupStep.codesCopied")
                )
                if (copied) setSavedCodes(true)
              }}
            >
              {t("backupStep.copyCodes")}
            </Button>
          </div>
          <DialogFooter>
            {savedCodes ? (
              stepCount
            ) : (
              <p className="text-xs text-muted-foreground sm:mr-auto sm:self-center">
                {t("backupStep.saveFirst")}
              </p>
            )}
            <Button
              type="button"
              variant={savedCodes ? "default" : "outline"}
              isDisabled={!savedCodes}
              onPress={() => {
                toast.success(t("enabled"))
                onDone(true)
              }}
            >
              {t("backupStep.done")}
            </Button>
          </DialogFooter>
        </div>
      ) : null}
    </Dialog>
  )
}
