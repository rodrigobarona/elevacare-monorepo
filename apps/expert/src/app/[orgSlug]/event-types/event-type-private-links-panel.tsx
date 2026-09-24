"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type { BookingLinkListItem } from "@eleva/api-client"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { Textarea } from "@eleva/ui/components/textarea"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { Badge } from "@eleva/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import {
  createBookingLinkAction,
  revokeBookingLinkAction,
} from "./booking-link-actions"
import type {
  LocationOption,
  ModeRow,
  ScheduleOption,
} from "./event-type-modes-panel"

interface Props {
  eventTypeId: string
  links: BookingLinkListItem[]
  modes: ModeRow[]
  schedules: ScheduleOption[]
  locations: LocationOption[]
}

function defaultExpiresAt(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function modeOptionLabel(
  mode: ModeRow,
  locations: LocationOption[],
  tKinds: (key: "online" | "phone" | "in_person") => string
): string {
  const kindLabel = tKinds(mode.mode)
  const custom = mode.label?.en?.trim()
  if (custom) return `${kindLabel} · ${custom}`
  if (mode.locationId) {
    const location = locations.find((l) => l.id === mode.locationId)
    if (location) return `${kindLabel} · ${location.label}`
  }
  return kindLabel
}

export function EventTypePrivateLinksPanel({
  eventTypeId,
  links: initialLinks,
  modes,
  schedules,
  locations,
}: Props) {
  const t = useTranslations("eventTypes.privateLinks")
  const tModeKinds = useTranslations("eventTypes.modes.kinds")
  const router = useRouter()
  const [links, setLinks] = React.useState(initialLinks)
  const [showForm, setShowForm] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [createdToken, setCreatedToken] = React.useState<{
    token: string
    urlPath: string
  } | null>(null)
  const [revokeId, setRevokeId] = React.useState<string | null>(null)

  const activeModes = modes.filter((m) => m.active)
  const [modeId, setModeId] = React.useState(activeModes[0]?.id ?? "")
  // Empty = no override; the link uses the mode's own schedule.
  const [scheduleId, setScheduleId] = React.useState("")
  const [recipientEmail, setRecipientEmail] = React.useState("")
  const [priceEuros, setPriceEuros] = React.useState("")
  const [note, setNote] = React.useState("")
  const [expiresLocal, setExpiresLocal] = React.useState(defaultExpiresAt)
  const [maxUses, setMaxUses] = React.useState("1")

  React.useEffect(() => {
    setLinks(initialLinks)
  }, [initialLinks])

  async function handleCreate() {
    setPending(true)
    setError(null)
    setCreatedToken(null)

    const expiresAt = new Date(expiresLocal)
    if (Number.isNaN(expiresAt.getTime())) {
      setError("invalid-input")
      setPending(false)
      return
    }

    const result = await createBookingLinkAction({
      eventTypeId,
      eventTypeModeId: modeId || null,
      scheduleId: scheduleId || null,
      recipientEmail: recipientEmail.trim() || null,
      priceCents: priceEuros ? Math.round(Number(priceEuros) * 100) : null,
      note: note.trim() || null,
      expiresAt: expiresAt.toISOString(),
      maxUses: Number(maxUses) || 1,
    })

    if (result.ok && result.token && result.urlPath && result.link) {
      setCreatedToken({ token: result.token, urlPath: result.urlPath })
      setLinks((prev) => [result.link!, ...prev])
      setShowForm(false)
      toast.success(t("created"))
      router.refresh()
    } else if (!result.ok) {
      setError(result.error)
    } else {
      setError("generic")
    }
    setPending(false)
  }

  async function handleRevoke() {
    if (!revokeId) return
    setPending(true)
    setError(null)
    const result = await revokeBookingLinkAction(revokeId)
    if (result.ok && result.link) {
      setLinks((prev) =>
        prev.map((link) => (link.id === result.link!.id ? result.link! : link))
      )
      toast.success(t("revoked"))
      setRevokeId(null)
      router.refresh()
    } else if (!result.ok) {
      setError(result.error)
    } else {
      setError("generic")
    }
    setPending(false)
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t("copied"))
    } catch {
      toast.error(t("copyFailed"))
    }
  }

  return (
    <Card data-testid="event-type-private-links-panel">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {t(`error.${error}` as "error.generic")}
            </AlertDescription>
          </Alert>
        ) : null}

        {createdToken ? (
          <Alert data-testid="private-link-token-once">
            <AlertDescription className="space-y-3">
              <p>{t("tokenOnce")}</p>
              <code className="block rounded-md bg-muted px-2 py-1 text-xs break-all">
                {createdToken.urlPath}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onPress={() =>
                    void copyText(
                      `${window.location.origin}${createdToken.urlPath}`
                    )
                  }
                >
                  {t("copyLink")}
                </Button>
                <LinkButton
                  size="sm"
                  variant="outline"
                  href={`mailto:?subject=${encodeURIComponent(t("mailtoSubject"))}&body=${encodeURIComponent(`${t("mailtoBody")}\n${typeof window !== "undefined" ? window.location.origin : ""}${createdToken.urlPath}`)}`}
                >
                  {t("sendEmail")}
                </LinkButton>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onPress={() => setCreatedToken(null)}
                >
                  {t("dismissToken")}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {!showForm ? (
          <Button
            type="button"
            onPress={() => setShowForm(true)}
            data-testid="private-link-create"
          >
            {t("create")}
          </Button>
        ) : (
          <div className="space-y-3 rounded-xl border p-4">
            <div className="space-y-1.5">
              <Select
                selectedKey={modeId || null}
                onSelectionChange={(key) => {
                  if (typeof key === "string") setModeId(key)
                }}
              >
                <Label>{t("fields.mode")}</Label>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeModes.map((mode) => {
                    const label = modeOptionLabel(mode, locations, tModeKinds)
                    return (
                      <SelectItem key={mode.id} id={mode.id} textValue={label}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Select
                selectedKey={scheduleId || "__mode__"}
                onSelectionChange={(key) => {
                  if (typeof key !== "string") return
                  setScheduleId(key === "__mode__" ? "" : key)
                }}
              >
                <Label>{t("fields.schedule")}</Label>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    id="__mode__"
                    textValue={t("fields.scheduleModeDefault")}
                  >
                    {t("fields.scheduleModeDefault")}
                  </SelectItem>
                  {schedules.map((schedule) => (
                    <SelectItem
                      key={schedule.id}
                      id={schedule.id}
                      textValue={schedule.name}
                    >
                      {schedule.name}
                      {schedule.isDefault ? ` (${t("defaultSchedule")})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pl-email">{t("fields.recipient")}</Label>
                <Input
                  id="pl-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder={t("fields.recipientPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-price">{t("fields.price")}</Label>
                <Input
                  id="pl-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={priceEuros}
                  onChange={(e) => setPriceEuros(e.target.value)}
                  placeholder={t("fields.pricePlaceholder")}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pl-expires">{t("fields.expires")}</Label>
                <Input
                  id="pl-expires"
                  type="datetime-local"
                  value={expiresLocal}
                  onChange={(e) => setExpiresLocal(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-uses">{t("fields.maxUses")}</Label>
                <Input
                  id="pl-uses"
                  type="number"
                  min={1}
                  max={100}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pl-note">{t("fields.note")}</Label>
              <Textarea
                id="pl-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("fields.notePlaceholder")}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onPress={handleCreate}
                isDisabled={pending || activeModes.length === 0}
                data-testid="private-link-save"
              >
                {pending ? t("saving") : t("save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onPress={() => setShowForm(false)}
                isDisabled={pending}
              >
                {t("cancel")}
              </Button>
            </div>
            {activeModes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("needMode")}</p>
            ) : null}
          </div>
        )}

        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul
            className="divide-y rounded-xl border"
            data-testid="private-links-table"
          >
            {links.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        link.status === "active" ? "default" : "secondary"
                      }
                    >
                      {t(`status.${link.status}`)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {t("uses", {
                        used: link.useCount,
                        max: link.maxUses,
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("expires", {
                      date: new Date(link.expiresAt).toLocaleString(),
                    })}
                  </p>
                  {link.note ? <p className="text-sm">{link.note}</p> : null}
                </div>
                {link.status === "active" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onPress={() => setRevokeId(link.id)}
                    data-testid={`private-link-revoke-${link.id}`}
                  >
                    {t("revoke")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <AlertDialog
          isOpen={revokeId != null}
          onOpenChange={(open) => {
            if (!open) setRevokeId(null)
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("revokeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel isDisabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onPress={handleRevoke}
              isDisabled={pending}
            >
              {pending ? t("revoking") : t("revokeConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
