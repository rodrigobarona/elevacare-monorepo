"use client"

import * as React from "react"
import Image from "next/image"
import { MinusIcon, PlusIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { Checkbox } from "@eleva/ui/components/checkbox"
import { cn } from "@eleva/ui/lib/utils"
import { PhaseInterstitialContent } from "@/components/wizard/phase-interstitial"
import { ChapterCover } from "@/components/wizard/chapter-cover"
import { StepFrame } from "@/components/wizard/step-frame"
import {
  AiSuggestDrawer,
  AiSuggestLink,
} from "@/components/wizard/ai-suggest-drawer"
import { MockPhotoUploader } from "@/domains/expert-onboarding/components/shared/mock-photo-uploader"
import { LocalizedFieldEditor } from "@/domains/expert-onboarding/components/shared/localized-field-editor"
import { SessionLanguagesSetup } from "@/domains/expert-onboarding/components/shared/session-languages-setup"
import { PricingPreview } from "@/domains/expert-onboarding/components/shared/pricing-preview"
import { ReviewChecklist } from "@/domains/expert-onboarding/components/shared/review-checklist"
import { PostSubmitHub } from "./post-submit-hub"
import { DashboardHandoff } from "./dashboard-handoff"
import { AiBridgeStep } from "./ai-bridge-step"
import {
  CountryLocationStep,
  MapConfirmLocationStep,
} from "@/components/map/location-step-panels"
import { CityLocationInput } from "@/components/map/city-location-input"
import { AddressLocationInput } from "@/components/map/address-location-input"
import { LocationStepLayout } from "@/components/map/location-step-layout"
import {
  getLocalized,
  setLocalized,
  type LocalizedField,
} from "@/domains/expert-onboarding/lib/draft-fields"
import { PEXELS, SAMPLE_COPY } from "@/domains/expert-onboarding/lib/assets"
import {
  COUNTRY_LABELS,
  LOCALE_LABELS,
  SPECIALTIES,
  type ExpertDraft,
  type Locale,
} from "@/domains/expert-onboarding/lib/types"
import type { WizardStep } from "@/lib/wizard-types"
import type { StepNavigationContext } from "@/lib/wizard-navigation"
import { useWizardLayout } from "@/components/wizard/wizard-layout-context"

interface StepRendererProps {
  step: WizardStep
  draft: ExpertDraft
  nav: StepNavigationContext
  onChange: (
    patch: Partial<ExpertDraft> | ((prev: ExpertDraft) => ExpertDraft)
  ) => void
  onSubmit?: () => void
}

export function StepRenderer({
  step,
  draft,
  nav,
  onChange,
  onSubmit,
}: StepRendererProps) {
  const [aiOpen, setAiOpen] = React.useState(false)
  const [aiContext, setAiContext] = React.useState("headline")
  const { variant } = useWizardLayout()

  const openAi = (context: string) => {
    setAiContext(context)
    setAiOpen(true)
  }

  if (step.kind === "interstitial") {
    const eyebrow =
      nav.chapterIndex != null && nav.chapterName
        ? `Chapter ${nav.chapterIndex} · ${nav.chapterName}`
        : (step.chapterLabel ?? "Before we begin")

    return (
      <ChapterCover
        eyebrow={eyebrow}
        chapterIndex={nav.chapterIndex}
        title={step.title}
        body={step.helper ?? ""}
        illustration={step.illustration}
      />
    )
  }

  if (step.kind === "split-intro") {
    return (
      <div className="px-6 py-12 sm:px-10">
        <PhaseInterstitialContent
          stepLabel="Live preview"
          title={step.title}
          body={step.helper ?? ""}
        />
        <p className="mt-8 max-w-md text-sm text-muted-foreground">
          Edit on the left. Members see updates on the right as you go.
        </p>
      </div>
    )
  }

  if (step.kind === "specialty-grid") {
    return (
      <StepFrame
        title={step.title}
        helper={step.helper}
        illustration={step.illustration}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SPECIALTIES.map((spec) => (
            <button
              key={spec.id}
              type="button"
              onClick={() => onChange({ specialty: spec.id, subSpecialty: "" })}
              className={cn(
                "rounded-2xl border px-5 py-6 text-left text-base font-medium transition-all sm:text-lg",
                draft.specialty === spec.id
                  ? "border-eleva-primary bg-eleva-primary/5 ring-2 ring-eleva-primary/20"
                  : "border-border/60 bg-background hover:border-eleva-primary/30"
              )}
            >
              {spec.label}
            </button>
          ))}
        </div>
      </StepFrame>
    )
  }

  if (step.kind === "chip-select") {
    const options =
      step.id === "p2-sub"
        ? (SPECIALTIES.find((s) => s.id === draft.specialty)?.subs.map(
            (sub) => ({
              id: sub.toLowerCase().replace(/\s+/g, "-"),
              label: sub,
            })
          ) ?? [])
        : (step.chipOptions ?? [])

    const value =
      step.id === "2-3-format" ? draft.sessionMode : draft.subSpecialty

    return (
      <StepFrame title={step.title} helper={step.helper}>
        <div className="flex flex-wrap gap-3">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (step.id === "2-3-format") {
                  onChange({
                    sessionMode: opt.id as ExpertDraft["sessionMode"],
                  })
                } else {
                  onChange({ subSpecialty: opt.id })
                }
              }}
              className={cn(
                "rounded-full border px-6 py-3 text-base font-medium transition-colors",
                value === opt.id
                  ? "border-eleva-primary bg-eleva-primary text-primary-foreground"
                  : "border-border bg-background hover:border-eleva-primary/40"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </StepFrame>
    )
  }

  if (step.kind === "country-grid") {
    return <CountryLocationStep step={step} draft={draft} onChange={onChange} />
  }

  if (step.kind === "city-search") {
    return (
      <LocationStepLayout
        title={step.title}
        helper={step.helper}
        draft={draft}
        stage="city"
        mapFooter={
          draft.cityGeocoded
            ? `${draft.city} — zoomed on the map`
            : "Pick or type a city to zoom in from your country"
        }
      >
        <CityLocationInput
          draft={draft}
          placeholder={step.placeholder}
          onChange={onChange}
        />
      </LocationStepLayout>
    )
  }

  if (step.kind === "text") {
    const field = step.id
    let value = ""
    let setValue = (v: string) => {}

    if (field === "p6-name") {
      value = draft.workspaceName
      setValue = (v) => onChange({ workspaceName: v })
    } else if (field === "1-3-title") {
      value = draft.professionalTitle
      setValue = (v) => onChange({ professionalTitle: v })
    } else if (field === "1-6-linkedin") {
      value = draft.linkedIn
      setValue = (v) => onChange({ linkedIn: v })
    } else if (field === "e-express-name") {
      value = draft.workspaceName
      setValue = (v) => onChange({ workspaceName: v })
    }

    const aiKey = field === "1-3-title" ? "professionalTitle" : undefined

    return (
      <StepFrame
        title={step.title}
        helper={step.helper}
        illustration={step.illustration}
        localeBadge={step.locale ? LOCALE_LABELS[step.locale] : undefined}
      >
        <div className="w-full space-y-3">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={step.placeholder}
            className="h-14 text-lg"
          />
          {step.maxLength ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {value.length} / {step.maxLength}
            </p>
          ) : null}
          {step.showAi && aiKey ? (
            <AiSuggestLink onClick={() => openAi(aiKey)} />
          ) : null}
        </div>
        <AiSuggestDrawer
          open={aiOpen}
          onOpenChange={setAiOpen}
          context={aiContext}
          onApply={(text) => setValue(text)}
        />
      </StepFrame>
    )
  }

  if (step.kind === "localized-field") {
    const field = step.localizedField as LocalizedField
    const primary = draft.primaryLocale

    return (
      <StepFrame
        title={step.title}
        helper={step.helper}
        illustration={step.illustration}
      >
        <LocalizedFieldEditor
          draft={draft}
          field={field}
          onChange={onChange}
          multiline={step.multiline}
          minLength={step.minLength}
          maxLength={step.maxLength}
          placeholder={step.placeholder}
          onSuggest={step.showAi ? () => openAi(field) : undefined}
        />
        <AiSuggestDrawer
          open={aiOpen}
          onOpenChange={setAiOpen}
          context={aiContext}
          locale={primary}
          onApply={(text) =>
            onChange((prev) => setLocalized(prev, field, primary, text))
          }
        />
      </StepFrame>
    )
  }

  if (step.kind === "textarea") {
    const locale = step.locale ?? "en"
    const locField =
      step.id === "1-4-qual"
        ? "qualifications"
        : step.id === "1-5-recog"
          ? "recognition"
          : step.id === "c-qual"
            ? "qualifications"
            : "eventDescription"
    const value = getLocalized(draft, locField, locale)

    return (
      <StepFrame
        title={step.title}
        helper={step.helper}
        localeBadge={LOCALE_LABELS[locale]}
      >
        <div className="w-full space-y-3">
          <textarea
            value={value}
            onChange={(e) =>
              onChange((prev) =>
                setLocalized(prev, locField, locale, e.target.value)
              )
            }
            rows={6}
            placeholder={step.placeholder}
            className="w-full resize-none rounded-xl border border-input bg-background px-4 py-4 text-base leading-relaxed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-lg"
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {value.length} / {step.minLength ?? 150} minimum
          </p>
          {step.showAi ? (
            <AiSuggestLink onClick={() => openAi("qualifications")} />
          ) : null}
        </div>
        <AiSuggestDrawer
          open={aiOpen}
          onOpenChange={setAiOpen}
          context={aiContext}
          onApply={(text) =>
            onChange((prev) => setLocalized(prev, locField, locale, text))
          }
        />
      </StepFrame>
    )
  }

  if (step.kind === "stepper") {
    const isYears = step.id.includes("years") || step.id === "1-1-years"
    const isDuration =
      step.id.includes("duration") ||
      step.id === "5-3-duration" ||
      step.id === "c-duration"
    const isPrice =
      step.id.includes("price") ||
      step.id === "6-1-price" ||
      step.id === "c-price"

    const value = isYears
      ? draft.yearsInField
      : isDuration
        ? draft.eventDuration
        : draft.eventPrice
    const setValue = (v: number) => {
      if (isYears) onChange({ yearsInField: v })
      else if (isDuration) onChange({ eventDuration: v })
      else onChange({ eventPrice: v })
    }
    const min = step.stepperMin ?? (isPrice ? 20 : 1)
    const max = step.stepperMax ?? (isYears ? 40 : isDuration ? 120 : 300)
    const suffix =
      step.stepperSuffix ?? (isPrice ? "€" : isDuration ? "min" : "years")

    return (
      <StepFrame
        title={step.title}
        helper={step.helper}
        illustration={step.illustration}
      >
        <div className="flex items-center gap-6">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-14 rounded-full"
            onClick={() =>
              setValue(Math.max(min, value - (isDuration ? 5 : 1)))
            }
            disabled={value <= min}
          >
            <MinusIcon className="size-5" />
          </Button>
          <div className="min-w-[8rem] text-center">
            <span className="text-5xl font-semibold tabular-nums">{value}</span>
            <span className="ml-3 text-xl text-muted-foreground">{suffix}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-14 rounded-full"
            onClick={() =>
              setValue(Math.min(max, value + (isDuration ? 5 : 1)))
            }
            disabled={value >= max}
          >
            <PlusIcon className="size-5" />
          </Button>
        </div>
      </StepFrame>
    )
  }

  if (step.kind === "yesno") {
    const field =
      step.id === "7-1-telehealth" || step.id === "d-telehealth"
        ? "telehealthAck"
        : step.id === "7-2-insurance" || step.id === "d-insurance"
          ? "insuranceAck"
          : "introOffers"
    const value = draft[field]

    return (
      <StepFrame title={step.title} helper={step.helper}>
        <div className="flex gap-3">
          {[true, false].map((opt) => (
            <button
              key={String(opt)}
              type="button"
              onClick={() => onChange({ [field]: opt })}
              className={cn(
                "flex-1 rounded-2xl border px-6 py-10 text-xl font-medium transition-all",
                value === opt
                  ? "border-eleva-primary bg-eleva-primary/5 ring-2 ring-eleva-primary/20"
                  : "border-border/60 bg-background hover:border-eleva-primary/30"
              )}
            >
              {opt ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </StepFrame>
    )
  }

  if (step.kind === "languages") {
    return (
      <StepFrame title={step.title} helper={step.helper}>
        <SessionLanguagesSetup draft={draft} onChange={onChange} />
      </StepFrame>
    )
  }

  if (step.kind === "address-search") {
    return (
      <LocationStepLayout
        title={step.title}
        helper={step.helper}
        draft={draft}
        stage="address"
        mapFooter="Street-level view — confirm the pin matches your address"
      >
        <AddressLocationInput
          draft={draft}
          placeholder={step.placeholder}
          onChange={onChange}
        />
      </LocationStepLayout>
    )
  }

  if (step.kind === "upload") {
    return (
      <StepFrame title={step.title} helper={step.helper}>
        <MockPhotoUploader
          photos={draft.photos}
          onChange={(photos) => onChange({ photos, coverPhotoIndex: 0 })}
          min={5}
        />
      </StepFrame>
    )
  }

  if (step.kind === "photo-review") {
    return (
      <StepFrame title={step.title} helper={step.helper}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {draft.photos.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => onChange({ coverPhotoIndex: i })}
              className={cn(
                "relative aspect-[4/3] overflow-hidden rounded-2xl ring-2 transition-all",
                draft.coverPhotoIndex === i
                  ? "ring-eleva-primary"
                  : "ring-transparent hover:ring-border"
              )}
            >
              <Image
                src={src}
                alt=""
                fill
                className="object-cover"
                sizes="200px"
              />
              {draft.coverPhotoIndex === i ? (
                <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium uppercase">
                  Cover
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </StepFrame>
    )
  }

  if (step.kind === "map-confirm") {
    return (
      <MapConfirmLocationStep step={step} draft={draft} onChange={onChange} />
    )
  }

  if (step.kind === "credential-cards") {
    return (
      <StepFrame title={step.title} helper={step.helper}>
        <div className="space-y-3">
          {["Professional title", "Qualifications", "Recognition"].map(
            (label, i) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-2xl border border-dashed border-border/80 px-4 py-4"
              >
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {i === 0 && draft.professionalTitle
                    ? "Added"
                    : i === 1 && draft.qualifications.en
                      ? "Added"
                      : "Next steps"}
                </span>
              </div>
            )
          )}
        </div>
      </StepFrame>
    )
  }

  if (step.kind === "earnings-info") {
    return (
      <StepFrame title={step.title} helper={step.helper}>
        <PricingPreview memberPrice={draft.eventPrice} />
      </StepFrame>
    )
  }

  if (step.kind === "event-summary") {
    return (
      <StepFrame title={step.title} helper={step.helper}>
        <div className="w-full rounded-2xl border border-border/60 bg-background p-6">
          <p className="font-medium">
            {draft.eventTitle.en || "Initial consultation"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {draft.eventDuration} min · {draft.sessionMode.replace("_", " ")} ·
            €{draft.eventPrice}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {draft.eventDescription.en ||
              "Session description will appear here."}
          </p>
        </div>
      </StepFrame>
    )
  }

  if (step.kind === "tax-id") {
    const labels = {
      PT: "NIF",
      ES: "NIF / IVA",
      BR: "CPF / CNPJ",
    }[draft.practiceCountry]
    return (
      <StepFrame title={step.title} helper={step.helper}>
        <div className="w-full space-y-2">
          <Label htmlFor="tax">{labels}</Label>
          <Input
            id="tax"
            value={draft.nif}
            onChange={(e) => onChange({ nif: e.target.value })}
            className="h-12"
          />
        </div>
      </StepFrame>
    )
  }

  if (step.kind === "license") {
    const labels = {
      PT: "Professional license (e.g. OPP 12345)",
      ES: "Colegio registration number",
      BR: "Conselho profissional registration",
    }[draft.practiceCountry]
    return (
      <StepFrame title={step.title} helper={step.helper}>
        <div className="w-full space-y-2">
          <Label htmlFor="license">{labels}</Label>
          <Input
            id="license"
            value={draft.licenseScope}
            onChange={(e) => onChange({ licenseScope: e.target.value })}
            className="h-12"
          />
        </div>
      </StepFrame>
    )
  }

  if (step.kind === "terms") {
    return (
      <StepFrame title={step.title} helper={step.helper}>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 p-4">
          <Checkbox
            checked={draft.termsAccepted && draft.complianceAck}
            onCheckedChange={(checked) =>
              onChange({ termsAccepted: !!checked, complianceAck: !!checked })
            }
          />
          <span className="text-sm leading-relaxed text-muted-foreground">
            I confirm my credentials are accurate and I agree to Eleva&apos;s
            expert terms and privacy policy for{" "}
            {COUNTRY_LABELS[draft.practiceCountry]}.
          </span>
        </label>
      </StepFrame>
    )
  }

  if (step.kind === "dark-review") {
    const items = [
      {
        id: "1",
        label: "Specialty & workspace",
        done: !!draft.specialty && !!draft.workspaceName,
      },
      {
        id: "2",
        label: "About you",
        done:
          !!draft.professionalTitle && draft.qualifications.en.length >= 150,
      },
      { id: "3", label: "Photos", done: draft.photos.length >= 5 },
      { id: "4", label: "Public profile", done: !!draft.headline.en },
      { id: "5", label: "First session", done: !!draft.eventTitle.en },
      { id: "6", label: "Pricing", done: draft.eventPrice > 0 },
      {
        id: "7",
        label: "Trust & compliance",
        done: draft.telehealthAck !== null && !!draft.nif,
      },
    ]
    return (
      <div
        className={cn(
          "px-6 py-10 sm:px-10",
          variant === "dots" &&
            "min-h-[calc(100vh-12rem)] bg-stone-950 text-stone-100"
        )}
      >
        <h1
          className={cn(
            "text-3xl font-semibold tracking-tight",
            variant === "dots" ? "text-white" : "text-foreground"
          )}
        >
          {step.title}
        </h1>
        {step.helper ? (
          <p
            className={cn(
              "mt-2",
              variant === "dots" ? "text-stone-400" : "text-muted-foreground"
            )}
          >
            {step.helper}
          </p>
        ) : null}
        <ReviewChecklist items={items} dark className="mt-8" />
      </div>
    )
  }

  if (step.kind === "post-submit") {
    return <PostSubmitHub draft={draft} />
  }

  if (step.kind === "dashboard-handoff") {
    return (
      <DashboardHandoff
        draft={draft}
        onCompleteProfile={onSubmit}
        complianceInline={false}
      />
    )
  }

  if (step.kind === "ai-bridge") {
    return (
      <AiBridgeStep
        title={step.title}
        helper={step.helper}
        onChange={onChange}
      />
    )
  }

  if (step.kind === "ai-summary") {
    if (variant === "express") {
      return (
        <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center bg-gradient-to-b from-eleva-primary/10 via-background to-background px-6 py-16">
          <div className="w-full max-w-lg text-center">
            <p className="text-sm font-semibold tracking-wider text-eleva-primary uppercase">
              AI draft ready
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {step.title}
            </h1>
            <p className="mt-3 text-muted-foreground">{step.helper}</p>
            <div className="mt-10 space-y-4 rounded-3xl border border-border/60 bg-background p-6 text-left shadow-lg">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Headline
                </p>
                <p className="mt-1 text-base font-medium">
                  {draft.headline.en || SAMPLE_COPY.headline.en}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  First session
                </p>
                <p className="mt-1 text-base font-medium">
                  {draft.eventTitle.en || SAMPLE_COPY.eventTitle.en}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  onChange({
                    headline: SAMPLE_COPY.headline,
                    qualifications: SAMPLE_COPY.qualifications,
                    eventTitle: SAMPLE_COPY.eventTitle,
                    eventDescription: SAMPLE_COPY.eventDescription,
                  })
                }
              >
                Regenerate draft
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <StepFrame title={step.title} helper={step.helper}>
        <div className="w-full space-y-4 rounded-2xl border border-border/60 bg-background p-6 text-left">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Headline
            </p>
            <p className="mt-1 text-sm">
              {draft.headline.en || SAMPLE_COPY.headline.en}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">
              First session
            </p>
            <p className="mt-1 text-sm">
              {draft.eventTitle.en || SAMPLE_COPY.eventTitle.en}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                headline: SAMPLE_COPY.headline,
                qualifications: SAMPLE_COPY.qualifications,
                eventTitle: SAMPLE_COPY.eventTitle,
                eventDescription: SAMPLE_COPY.eventDescription,
              })
            }
          >
            Regenerate draft
          </Button>
        </div>
      </StepFrame>
    )
  }

  return null
}
