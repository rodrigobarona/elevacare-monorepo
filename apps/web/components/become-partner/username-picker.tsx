"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Check, Loader2, X } from "lucide-react"

import { Input } from "@eleva/ui/components/input"
import { cn } from "@eleva/ui/lib/utils"
import { validateUsername } from "@eleva/config/reserved-usernames"
import {
  checkUsernameAction,
  type UsernameCheckResult,
} from "@/app/[locale]/become-partner/actions"

interface UsernamePickerProps {
  value: string
  onChange: (value: string) => void
  onAvailabilityChange?: (result: UsernameCheckResult | null) => void
  ariaInvalid?: boolean
  id?: string
}

type LocalState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; username: string }
  | { state: "unavailable"; username: string; reason: string }

export function UsernamePicker({
  value,
  onChange,
  onAvailabilityChange,
  ariaInvalid,
  id,
}: UsernamePickerProps) {
  const t = useTranslations("becomePartner.username")

  // Derive synchronous (non-network) status from the input alone so we
  // never have to setState during render. The async availability state
  // is layered on top and can override the synchronous "checking"
  // baseline once the network check resolves.
  const trimmed = value.trim().toLowerCase()
  const formatErr = trimmed.length === 0 ? null : validateUsername(trimmed)

  type AsyncStatus =
    | { kind: "idle" }
    | { kind: "available"; username: string }
    | { kind: "unavailable"; username: string; reason: string }

  const [asyncStatus, setAsyncStatus] = React.useState<AsyncStatus>({
    kind: "idle",
  })

  React.useEffect(() => {
    if (trimmed.length === 0 || formatErr) {
      onAvailabilityChange?.(
        formatErr
          ? {
              username: trimmed,
              status: {
                available: false,
                reason:
                  formatErr === "reserved" ? "reserved" : "format-invalid",
              },
            }
          : null
      )
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const result = await checkUsernameAction(trimmed)
        if (cancelled) return
        if (result.status.available) {
          setAsyncStatus({ kind: "available", username: trimmed })
        } else {
          setAsyncStatus({
            kind: "unavailable",
            username: trimmed,
            reason: result.status.reason ?? "format-invalid",
          })
        }
        onAvailabilityChange?.(result)
      } catch {
        if (cancelled) return
        setAsyncStatus({ kind: "idle" })
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [trimmed, formatErr, onAvailabilityChange])

  const status: LocalState = (() => {
    if (trimmed.length === 0) return { state: "idle" }
    if (formatErr) {
      return {
        state: "unavailable",
        username: trimmed,
        reason: formatErr === "reserved" ? "reserved" : "format-invalid",
      }
    }
    if (asyncStatus.kind === "available" && asyncStatus.username === trimmed) {
      return { state: "available", username: trimmed }
    }
    if (
      asyncStatus.kind === "unavailable" &&
      asyncStatus.username === trimmed
    ) {
      return {
        state: "unavailable",
        username: trimmed,
        reason: asyncStatus.reason,
      }
    }
    return { state: "checking" }
  })()

  const inputId = id ?? "username-picker"

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-stretch overflow-hidden rounded-md border border-input shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
        <span className="inline-flex items-center bg-muted px-3 text-sm text-muted-foreground select-none">
          eleva.care/
        </span>
        <Input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          maxLength={30}
          placeholder="ana-silva"
          aria-invalid={
            ariaInvalid || status.state === "unavailable" ? true : undefined
          }
          className="border-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <UsernameStatus status={status} t={t} />
    </div>
  )
}

function UsernameStatus({
  status,
  t,
}: {
  status: LocalState
  t: ReturnType<typeof useTranslations>
}) {
  if (status.state === "idle") return null

  if (status.state === "checking") {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {t("checking")}
      </p>
    )
  }

  if (status.state === "available") {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
        <Check className="size-3.5" />
        {t("available", { username: status.username })}
      </p>
    )
  }

  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-destructive"
      )}
    >
      <X className="size-3.5" />
      {t(`unavailable.${status.reason}`, { username: status.username })}
    </p>
  )
}
