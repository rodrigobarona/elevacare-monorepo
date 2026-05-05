"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { Textarea } from "@eleva/ui/components/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { Checkbox } from "@eleva/ui/components/checkbox"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import {
  createEventTypeAction,
  updateEventTypeAction,
  type EventTypeFormData,
} from "./actions"

type LocalizedText = { en: string; pt?: string; es?: string }

interface Props {
  mode: "create" | "edit"
  eventTypeId?: string
  defaultValues?: Partial<EventTypeFormData>
}

const LOCALES = ["en", "pt", "es"] as const
const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
}

export function EventTypeForm({ mode, eventTypeId, defaultValues }: Props) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [activeLocale, setActiveLocale] = React.useState<string>("en")

  const [slug, setSlug] = React.useState(defaultValues?.slug ?? "")
  const [title, setTitle] = React.useState<LocalizedText>(
    defaultValues?.title ?? { en: "" }
  )
  const [description, setDescription] = React.useState<LocalizedText>(
    defaultValues?.description ?? { en: "" }
  )
  const [duration, setDuration] = React.useState(
    String(defaultValues?.durationMinutes ?? 60)
  )
  const [price, setPrice] = React.useState(
    String((defaultValues?.priceAmount ?? 0) / 100)
  )
  const [currency, setCurrency] = React.useState(
    defaultValues?.currency ?? "eur"
  )
  const [sessionMode, setSessionMode] = React.useState(
    defaultValues?.sessionMode ?? "online"
  )
  const [languages, setLanguages] = React.useState<string[]>(
    defaultValues?.languages ?? ["en"]
  )
  const [bookingWindow, setBookingWindow] = React.useState(
    defaultValues?.bookingWindowDays != null
      ? String(defaultValues.bookingWindowDays)
      : ""
  )
  const [minimumNotice, setMinimumNotice] = React.useState(
    String(defaultValues?.minimumNoticeMinutes ?? 60)
  )
  const [bufferBefore, setBufferBefore] = React.useState(
    String(defaultValues?.bufferBeforeMinutes ?? 0)
  )
  const [bufferAfter, setBufferAfter] = React.useState(
    String(defaultValues?.bufferAfterMinutes ?? 0)
  )
  const [cancellationWindow, setCancellationWindow] = React.useState(
    defaultValues?.cancellationWindowHours != null
      ? String(defaultValues.cancellationWindowHours)
      : ""
  )
  const [rescheduleWindow, setRescheduleWindow] = React.useState(
    defaultValues?.rescheduleWindowHours != null
      ? String(defaultValues.rescheduleWindowHours)
      : ""
  )
  const [requiresApproval, setRequiresApproval] = React.useState(
    defaultValues?.requiresApproval ?? false
  )
  const [worldwideMode, setWorldwideMode] = React.useState(
    defaultValues?.worldwideMode ?? false
  )

  function autoSlug(titleEn: string): string {
    return titleEn
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const formData: EventTypeFormData = {
      slug: slug || autoSlug(title.en),
      title,
      description: description.en ? description : undefined,
      durationMinutes: Number(duration) || 60,
      priceAmount: Math.round((Number(price) || 0) * 100),
      currency,
      languages,
      sessionMode: sessionMode as "online" | "in_person" | "phone",
      bookingWindowDays: bookingWindow ? Number(bookingWindow) : null,
      minimumNoticeMinutes: Number(minimumNotice) || 60,
      bufferBeforeMinutes: Number(bufferBefore) || 0,
      bufferAfterMinutes: Number(bufferAfter) || 0,
      cancellationWindowHours: cancellationWindow
        ? Number(cancellationWindow)
        : null,
      rescheduleWindowHours: rescheduleWindow ? Number(rescheduleWindow) : null,
      requiresApproval,
      worldwideMode,
    }

    const result =
      mode === "create"
        ? await createEventTypeAction(formData)
        : await updateEventTypeAction(eventTypeId!, formData)

    if (result.ok) {
      router.push("/expert/event-types")
    } else {
      setError(result.error)
    }
    setPending(false)
  }

  function toggleLanguage(lang: string) {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error === "slug-taken"
              ? "This slug is already in use. Choose a different one."
              : error === "slug-too-short"
                ? "Slug must be at least 3 characters."
                : "Something went wrong. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1 border-b">
            {LOCALES.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setActiveLocale(loc)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeLocale === loc
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {LOCALE_LABELS[loc]}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Title ({LOCALE_LABELS[activeLocale]})</Label>
            <Input
              value={
                activeLocale === "en"
                  ? title.en
                  : (title[activeLocale as "pt" | "es"] ?? "")
              }
              onChange={(e) => {
                const val = e.target.value
                setTitle((prev) => ({ ...prev, [activeLocale]: val }))
                if (activeLocale === "en" && mode === "create" && !slug) {
                  setSlug(autoSlug(val))
                }
              }}
              placeholder="e.g., Initial Consultation"
              required={activeLocale === "en"}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description ({LOCALE_LABELS[activeLocale]})</Label>
            <Textarea
              value={
                activeLocale === "en"
                  ? description.en
                  : (description[activeLocale as "pt" | "es"] ?? "")
              }
              onChange={(e) =>
                setDescription((prev) => ({
                  ...prev,
                  [activeLocale]: e.target.value,
                }))
              }
              placeholder="Describe what patients can expect"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">URL Slug</Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>eleva.care/[username]/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="initial-consultation"
                pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                className="max-w-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duration (min)</Label>
              <Input
                id="duration"
                type="number"
                min={15}
                max={480}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="50.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eur">EUR</SelectItem>
                  <SelectItem value="usd">USD</SelectItem>
                  <SelectItem value="gbp">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Session mode</Label>
            <Select
              value={sessionMode}
              onValueChange={(v) => setSessionMode(v as typeof sessionMode)}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online (video)</SelectItem>
                <SelectItem value="in_person">In person</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Languages supported</Label>
            <div className="flex gap-4">
              {LOCALES.map((lang) => (
                <label key={lang} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={languages.includes(lang)}
                    onCheckedChange={() => toggleLanguage(lang)}
                  />
                  {LOCALE_LABELS[lang]}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bookingWindow">
                Booking window (days in advance)
              </Label>
              <Input
                id="bookingWindow"
                type="number"
                min={1}
                value={bookingWindow}
                onChange={(e) => setBookingWindow(e.target.value)}
                placeholder="No limit"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minimumNotice">Minimum notice (min)</Label>
              <Input
                id="minimumNotice"
                type="number"
                min={0}
                value={minimumNotice}
                onChange={(e) => setMinimumNotice(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bufferBefore">Buffer before (min)</Label>
              <Input
                id="bufferBefore"
                type="number"
                min={0}
                value={bufferBefore}
                onChange={(e) => setBufferBefore(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bufferAfter">Buffer after (min)</Label>
              <Input
                id="bufferAfter"
                type="number"
                min={0}
                value={bufferAfter}
                onChange={(e) => setBufferAfter(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cancellationWindow">
                Cancellation window (hours)
              </Label>
              <Input
                id="cancellationWindow"
                type="number"
                min={0}
                value={cancellationWindow}
                onChange={(e) => setCancellationWindow(e.target.value)}
                placeholder="No limit"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rescheduleWindow">
                Reschedule window (hours)
              </Label>
              <Input
                id="rescheduleWindow"
                type="number"
                min={0}
                value={rescheduleWindow}
                onChange={(e) => setRescheduleWindow(e.target.value)}
                placeholder="No limit"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={requiresApproval}
                onCheckedChange={(v) => setRequiresApproval(!!v)}
              />
              Require manual approval for bookings
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={worldwideMode}
                onCheckedChange={(v) => setWorldwideMode(!!v)}
              />
              Worldwide mode (bypass country-license validation)
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || !title.en}>
          {pending
            ? "Saving..."
            : mode === "create"
              ? "Create event type"
              : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/expert/event-types")}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
