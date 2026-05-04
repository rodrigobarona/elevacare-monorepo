"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"

import { Button } from "@eleva/ui/components/button"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { Textarea } from "@eleva/ui/components/textarea"
import { Checkbox } from "@eleva/ui/components/checkbox"
import { Badge } from "@eleva/ui/components/badge"
import { cn } from "@eleva/ui/lib/utils"

import { Link } from "@/i18n/navigation"
import {
  ApplicationDocumentInput,
  becomePartnerSubmissionSchema,
  supportedCountries,
  supportedLanguages,
  type ApplicantType,
  type BecomePartnerSubmissionInput,
} from "@/lib/become-partner/schema"
import { UsernamePicker } from "@/components/become-partner/username-picker"
import { DocumentUploadList } from "@/components/become-partner/document-upload"
import {
  submitApplicationAction,
  type SubmitApplicationResult,
  type UsernameCheckResult,
} from "@/app/[locale]/become-partner/actions"

const STEPS = [
  "account",
  "fiscal",
  "categories",
  "documents",
  "review",
] as const
type Step = (typeof STEPS)[number]

interface CategoryOption {
  slug: string
  name: string
  description?: string | null
}

interface BecomePartnerFormProps {
  categories: CategoryOption[]
}

interface FormState {
  type: ApplicantType
  displayName: string
  username: string
  bio: string
  nif: string
  licenseNumber: string
  licenseScope: string
  languages: string[]
  practiceCountries: string[]
  categorySlugs: string[]
  documents: ApplicationDocumentInput[]
  consent: boolean
}

const INITIAL: FormState = {
  type: "solo_expert",
  displayName: "",
  username: "",
  bio: "",
  nif: "",
  licenseNumber: "",
  licenseScope: "",
  languages: [],
  practiceCountries: [],
  categorySlugs: [],
  documents: [],
  consent: false,
}

export function BecomePartnerForm({ categories }: BecomePartnerFormProps) {
  const t = useTranslations()
  const router = useRouter()
  const [step, setStep] = React.useState<Step>("account")
  const [form, setForm] = React.useState<FormState>(INITIAL)
  const [usernameStatus, setUsernameStatus] =
    React.useState<UsernameCheckResult | null>(null)
  const [stepErrors, setStepErrors] = React.useState<string[]>([])
  const [submitState, setSubmitState] = React.useState<
    "idle" | "submitting" | "success"
  >("idle")
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const stepIndex = STEPS.indexOf(step)
  const totalSteps = STEPS.length

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validateStep(target: Step): string[] {
    switch (target) {
      case "account": {
        const errs: string[] = []
        if (form.displayName.trim().length < 2) errs.push("displayName")
        if (form.username.trim().length < 3) errs.push("username")
        if (
          usernameStatus &&
          !usernameStatus.status.available &&
          usernameStatus.username === form.username.trim().toLowerCase()
        ) {
          errs.push("username")
        }
        return errs
      }
      case "fiscal": {
        const errs: string[] = []
        if (form.languages.length === 0) errs.push("languages")
        if (form.practiceCountries.length === 0) errs.push("countries")
        return errs
      }
      case "categories": {
        return form.categorySlugs.length === 0 ? ["categories"] : []
      }
      case "documents": {
        const hasLicense = form.documents.some((d) => d.kind === "license")
        return hasLicense ? [] : ["license"]
      }
      case "review":
        return form.consent ? [] : ["consent"]
    }
  }

  function goNext() {
    const errs = validateStep(step)
    if (errs.length > 0) {
      setStepErrors(errs)
      return
    }
    setStepErrors([])
    const next = STEPS[stepIndex + 1]
    if (next) setStep(next)
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1]
    if (prev) {
      setStepErrors([])
      setStep(prev)
    }
  }

  async function onSubmit() {
    const errs = validateStep("review")
    if (errs.length > 0) {
      setStepErrors(errs)
      return
    }
    setSubmitState("submitting")
    setSubmitError(null)

    const payload: BecomePartnerSubmissionInput = {
      type: form.type,
      displayName: form.displayName.trim(),
      username: form.username.trim().toLowerCase(),
      bio: form.bio.trim(),
      nif: form.nif.trim(),
      licenseNumber: form.licenseNumber.trim(),
      licenseScope: form.licenseScope.trim(),
      languages: form.languages as BecomePartnerSubmissionInput["languages"],
      practiceCountries:
        form.practiceCountries as BecomePartnerSubmissionInput["practiceCountries"],
      categorySlugs: form.categorySlugs,
      documents: form.documents,
      consent: true,
    }

    // Defence in depth: re-validate locally before invoking the action.
    const parsed = becomePartnerSubmissionSchema.safeParse(payload)
    if (!parsed.success) {
      setSubmitError(t("becomePartner.errors.validation"))
      setSubmitState("idle")
      return
    }

    let result: SubmitApplicationResult
    try {
      result = await submitApplicationAction(parsed.data)
    } catch {
      setSubmitError(t("becomePartner.errors.submit"))
      setSubmitState("idle")
      return
    }

    if (result.ok) {
      setSubmitState("success")
      router.refresh()
      return
    }

    if (result.error === "auth") {
      setSubmitError(t("becomePartner.errors.auth"))
    } else if (
      result.error === "username-taken" ||
      result.error === "duplicate-application"
    ) {
      setStep("account")
      setStepErrors(["username"])
      setSubmitError(t("becomePartner.errors.submit"))
    } else {
      setSubmitError(t("becomePartner.errors.submit"))
    }
    setSubmitState("idle")
  }

  if (submitState === "success") {
    return <SuccessState />
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
      <Stepper currentStep={step} />
      <div className="grid gap-6">
        <p className="text-sm text-muted-foreground">
          {t("becomePartner.stepLabel", {
            current: stepIndex + 1,
            total: totalSteps,
          })}
        </p>

        {step === "account" ? (
          <AccountStep
            form={form}
            update={update}
            errors={stepErrors}
            onUsernameAvailability={setUsernameStatus}
          />
        ) : null}
        {step === "fiscal" ? (
          <FiscalStep form={form} update={update} errors={stepErrors} />
        ) : null}
        {step === "categories" ? (
          <CategoriesStep
            form={form}
            update={update}
            errors={stepErrors}
            categories={categories}
          />
        ) : null}
        {step === "documents" ? (
          <DocumentsStep form={form} update={update} errors={stepErrors} />
        ) : null}
        {step === "review" ? (
          <ReviewStep
            form={form}
            categories={categories}
            update={update}
            errors={stepErrors}
          />
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <FormFooter
          step={step}
          stepIndex={stepIndex}
          submitting={submitState === "submitting"}
          onBack={goBack}
          onNext={goNext}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  )
}

function Stepper({ currentStep }: { currentStep: Step }) {
  const t = useTranslations("becomePartner.steps")
  return (
    <ol
      role="list"
      className="flex flex-row gap-1 rounded-2xl border border-border/60 bg-card p-2 lg:flex-col lg:p-3"
    >
      {STEPS.map((step, idx) => {
        const isActive = step === currentStep
        const isPast = STEPS.indexOf(currentStep) > idx
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              isActive && "bg-primary/10 text-foreground",
              !isActive && isPast && "text-muted-foreground",
              !isActive && !isPast && "text-muted-foreground/70"
            )}
            aria-current={isActive ? "step" : undefined}
          >
            <span
              className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-xs",
                isActive && "border-primary text-primary",
                isPast && "border-primary bg-primary text-primary-foreground"
              )}
            >
              {isPast ? <Check className="size-3" /> : idx + 1}
            </span>
            <span className="hidden text-xs font-medium lg:inline">
              {t(step)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function AccountStep({
  form,
  update,
  errors,
  onUsernameAvailability,
}: {
  form: FormState
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  errors: string[]
  onUsernameAvailability: (result: UsernameCheckResult | null) => void
}) {
  const t = useTranslations("becomePartner.account")
  const tType = useTranslations("becomePartner.account.type")
  return (
    <section className="grid gap-4">
      <header>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{tType("label")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["solo_expert", "clinic_admin"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm",
                form.type === value &&
                  "border-primary bg-primary/5 text-foreground"
              )}
            >
              <input
                type="radio"
                name="applicantType"
                value={value}
                className="sr-only"
                checked={form.type === value}
                onChange={() => update("type", value)}
              />
              {tType(value === "solo_expert" ? "soloExpert" : "clinicAdmin")}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        id="displayName"
        label={t("displayName")}
        invalid={errors.includes("displayName")}
      >
        <Input
          id="displayName"
          value={form.displayName}
          onChange={(e) => update("displayName", e.target.value)}
          placeholder={t("displayNamePlaceholder")}
          maxLength={120}
          autoComplete="name"
        />
      </Field>

      <div className="grid gap-1.5">
        <Label htmlFor="username">{t("username")}</Label>
        <UsernamePicker
          id="username"
          value={form.username}
          onChange={(v) => update("username", v)}
          onAvailabilityChange={onUsernameAvailability}
          ariaInvalid={errors.includes("username")}
        />
        <p className="text-xs text-muted-foreground">{t("usernameHelper")}</p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="bio">{t("bio")}</Label>
        <Textarea
          id="bio"
          value={form.bio}
          onChange={(e) => update("bio", e.target.value.slice(0, 600))}
          placeholder={t("bioPlaceholder")}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          {t("bioHelper", { count: form.bio.length })}
        </p>
      </div>
    </section>
  )
}

function FiscalStep({
  form,
  update,
  errors,
}: {
  form: FormState
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  errors: string[]
}) {
  const t = useTranslations("becomePartner.fiscal")
  return (
    <section className="grid gap-4">
      <header>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Field id="nif" label={t("nif")} helper={t("nifHelper")}>
        <Input
          id="nif"
          value={form.nif}
          onChange={(e) => update("nif", e.target.value.slice(0, 32))}
          placeholder="123456789"
          inputMode="numeric"
          autoComplete="off"
        />
      </Field>

      <Field id="licenseNumber" label={t("licenseNumber")}>
        <Input
          id="licenseNumber"
          value={form.licenseNumber}
          onChange={(e) => update("licenseNumber", e.target.value.slice(0, 64))}
          placeholder={t("licenseNumberPlaceholder")}
        />
      </Field>

      <Field id="licenseScope" label={t("licenseScope")}>
        <Textarea
          id="licenseScope"
          value={form.licenseScope}
          onChange={(e) => update("licenseScope", e.target.value.slice(0, 400))}
          placeholder={t("licenseScopePlaceholder")}
          rows={3}
        />
      </Field>

      <ChipSet
        legend={t("languages")}
        helper={t("languagesHelper")}
        invalid={errors.includes("languages")}
        options={supportedLanguages.map((l) => ({
          value: l,
          label: l.toUpperCase(),
        }))}
        selected={form.languages}
        onChange={(next) => update("languages", next)}
      />

      <ChipSet
        legend={t("countries")}
        helper={t("countriesHelper")}
        invalid={errors.includes("countries")}
        options={supportedCountries.map((c) => ({ value: c, label: c }))}
        selected={form.practiceCountries}
        onChange={(next) => update("practiceCountries", next)}
      />
    </section>
  )
}

function CategoriesStep({
  form,
  update,
  errors,
  categories,
}: {
  form: FormState
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  errors: string[]
  categories: CategoryOption[]
}) {
  const t = useTranslations("becomePartner.categories")

  function toggle(slug: string) {
    if (form.categorySlugs.includes(slug)) {
      update(
        "categorySlugs",
        form.categorySlugs.filter((s) => s !== slug)
      )
    } else if (form.categorySlugs.length < 3) {
      update("categorySlugs", [...form.categorySlugs, slug])
    }
  }

  return (
    <section className="grid gap-4">
      <header>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {categories.length === 0 ? (
        <Alert>
          <AlertDescription>{t("empty")}</AlertDescription>
        </Alert>
      ) : (
        <ul
          className={cn(
            "grid gap-2 sm:grid-cols-2",
            errors.includes("categories") &&
              "-mx-1 rounded-md border border-destructive p-1 ring-1 ring-destructive/30"
          )}
        >
          {categories.map((c) => {
            const isSelected = form.categorySlugs.includes(c.slug)
            const disabled = !isSelected && form.categorySlugs.length >= 3
            return (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => toggle(c.slug)}
                  disabled={disabled}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 rounded-md border border-input px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
                    isSelected && "border-primary bg-primary/5 text-foreground"
                  )}
                  aria-pressed={isSelected}
                >
                  <span className="font-medium">{c.name}</span>
                  {c.description ? (
                    <span className="text-xs text-muted-foreground">
                      {c.description}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {t("limitHelper", {
          selected: form.categorySlugs.length,
          max: 3,
        })}
      </p>
    </section>
  )
}

function DocumentsStep({
  form,
  update,
  errors,
}: {
  form: FormState
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  errors: string[]
}) {
  const t = useTranslations("becomePartner.documents")
  return (
    <section className="grid gap-4">
      <header>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <DocumentUploadList
        documents={form.documents}
        onChange={(docs) => update("documents", docs)}
      />

      {errors.includes("license") ? (
        <Alert variant="destructive">
          <AlertDescription>{t("errors.missingLicense")}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}

function ReviewStep({
  form,
  categories,
  update,
  errors,
}: {
  form: FormState
  categories: CategoryOption[]
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  errors: string[]
}) {
  const t = useTranslations("becomePartner.review")
  return (
    <section className="grid gap-4">
      <header>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <ReviewSection title="becomePartner.account.title">
        <ReviewRow
          label="becomePartner.account.displayName"
          value={form.displayName}
        />
        <ReviewRow
          label="becomePartner.account.username"
          value={`eleva.care/${form.username || "—"}`}
        />
        <ReviewRow label="becomePartner.account.bio" value={form.bio || "—"} />
      </ReviewSection>

      <ReviewSection title="becomePartner.fiscal.title">
        <ReviewRow label="becomePartner.fiscal.nif" value={form.nif || "—"} />
        <ReviewRow
          label="becomePartner.fiscal.licenseNumber"
          value={form.licenseNumber || "—"}
        />
        <ReviewRow
          label="becomePartner.fiscal.languages"
          value={form.languages.map((l) => l.toUpperCase()).join(", ") || "—"}
        />
        <ReviewRow
          label="becomePartner.fiscal.countries"
          value={form.practiceCountries.join(", ") || "—"}
        />
      </ReviewSection>

      <ReviewSection title="becomePartner.categories.title">
        <ReviewBadges
          values={form.categorySlugs.map(
            (slug) => categories.find((c) => c.slug === slug)?.name ?? slug
          )}
        />
      </ReviewSection>

      <ReviewSection title="becomePartner.documents.title">
        <ul className="space-y-1 text-sm text-muted-foreground">
          {form.documents.map((d) => (
            <li key={d.kind}>
              <span className="font-medium text-foreground">{d.kind}:</span>{" "}
              {d.name}
            </li>
          ))}
        </ul>
      </ReviewSection>

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-md border border-input px-3 py-3 text-sm",
          errors.includes("consent") && "border-destructive"
        )}
      >
        <Checkbox
          checked={form.consent}
          onCheckedChange={(v) => update("consent", v === true)}
          aria-invalid={errors.includes("consent")}
        />
        <span>{t("consentLabel")}</span>
      </label>
    </section>
  )
}

function ReviewSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const t = useTranslations()
  return (
    <div className="rounded-2xl border border-border/60 p-4">
      <h3 className="text-sm font-semibold text-foreground">{t(title)}</h3>
      <div className="mt-2 grid gap-1.5 text-sm">{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const t = useTranslations()
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">
        {t(label)}
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  )
}

function ReviewBadges({ values }: { values: string[] }) {
  if (values.length === 0)
    return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <Badge key={v} variant="secondary">
          {v}
        </Badge>
      ))}
    </div>
  )
}

function Field({
  id,
  label,
  helper,
  invalid,
  children,
}: {
  id: string
  label: string
  helper?: string
  invalid?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} data-error={invalid ? true : undefined}>
        {label}
      </Label>
      {children}
      {helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  )
}

function ChipSet({
  legend,
  helper,
  options,
  selected,
  onChange,
  invalid,
}: {
  legend: string
  helper: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  invalid?: boolean
}) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value))
    } else {
      onChange([...selected, value])
    }
  }
  return (
    <fieldset className="grid gap-2">
      <legend
        className="text-sm font-medium"
        data-error={invalid ? true : undefined}
      >
        {legend}
      </legend>
      <div
        className={cn(
          "flex flex-wrap gap-2",
          invalid && "rounded-md border-destructive"
        )}
      >
        {options.map((o) => {
          const active = selected.includes(o.value)
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => toggle(o.value)}
              className={cn(
                "rounded-full border border-input px-3 py-1.5 text-sm transition-colors",
                active && "border-primary bg-primary/10 text-foreground"
              )}
              aria-pressed={active}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{helper}</p>
    </fieldset>
  )
}

function FormFooter({
  step,
  stepIndex,
  submitting,
  onBack,
  onNext,
  onSubmit,
}: {
  step: Step
  stepIndex: number
  submitting: boolean
  onBack: () => void
  onNext: () => void
  onSubmit: () => void
}) {
  const t = useTranslations()
  return (
    <div className="flex items-center justify-between border-t border-border/60 pt-4">
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={stepIndex === 0 || submitting}
      >
        <ArrowLeft />
        {t("common.back")}
      </Button>
      {step === "review" ? (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          size="lg"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {submitting
            ? t("becomePartner.review.submitting")
            : t("becomePartner.review.submitCta")}
        </Button>
      ) : (
        <Button type="button" onClick={onNext}>
          {t("common.next")}
          <ArrowRight />
        </Button>
      )}
    </div>
  )
}

function SuccessState() {
  const t = useTranslations("becomePartner.success")
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card p-10 text-center">
      <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Check className="size-6" />
      </div>
      <h1 className="mt-6 font-heading text-2xl font-semibold text-foreground">
        {t("title")}
      </h1>
      <p className="mt-3 text-base text-muted-foreground">{t("body")}</p>
      <Button asChild className="mt-6">
        <Link href="/">{t("back")}</Link>
      </Button>
    </div>
  )
}
