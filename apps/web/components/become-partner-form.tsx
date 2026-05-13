"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react"

import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Textarea } from "@eleva/ui/components/textarea"
import { Label } from "@eleva/ui/components/label"
import { Checkbox } from "@eleva/ui/components/checkbox"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import {
  supportedLanguages,
  supportedCountries,
  type BecomePartnerSubmissionInput,
} from "@/lib/become-partner/schema"
import {
  submitApplicationAction,
  checkUsernameAction,
} from "@/app/[locale]/become-partner/actions"

const STEPS = [
  "account",
  "fiscal",
  "categories",
  "documents",
  "review",
] as const
type Step = (typeof STEPS)[number]

const formSchema = z.object({
  type: z.enum(["solo_expert", "clinic_admin"]),
  displayName: z.string().min(2).max(120),
  username: z.string().min(3).max(30),
  bio: z.string().max(600).optional(),
  nif: z.string().max(32).optional(),
  licenseNumber: z.string().max(64).optional(),
  licenseScope: z.string().max(400).optional(),
  languages: z.array(z.string()).min(1),
  practiceCountries: z.array(z.string()).min(1),
  categorySlugs: z.array(z.string()).min(1).max(3),
  consent: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

interface BecomePartnerFormProps {
  categories: Array<{ slug: string; name: string }>
}

export function BecomePartnerForm({ categories }: BecomePartnerFormProps) {
  const t = useTranslations("becomePartner")
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [usernameStatus, setUsernameStatus] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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
      consent: false,
    },
  })

  const currentStep = STEPS[step]!

  async function checkUsername(username: string) {
    if (username.length < 3) return
    const result = await checkUsernameAction(username)
    if (result.status.available) {
      setUsernameStatus("available")
    } else {
      setUsernameStatus(result.status.reason ?? "unavailable")
    }
  }

  async function onSubmit(values: FormValues) {
    startTransition(async () => {
      const payload: BecomePartnerSubmissionInput = {
        ...values,
        bio: values.bio || "",
        nif: values.nif || "",
        licenseNumber: values.licenseNumber || "",
        licenseScope: values.licenseScope || "",
        languages: values.languages as ("pt" | "en" | "es")[],
        practiceCountries: values.practiceCountries as ("PT" | "ES" | "BR")[],
        documents: [],
        consent: true,
      }

      const result = await submitApplicationAction(payload)
      if (result.ok) {
        setSubmitted(true)
      } else {
        toast.error(t(`errors.${result.error}`))
      }
    })
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <CheckCircle2 className="mx-auto size-16 text-primary" />
        <h2 className="mt-6 font-heading text-2xl font-semibold text-foreground">
          {t("success.title")}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("success.body")}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${
                i <= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {t(`steps.${s}`)}
            </span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-heading">
            {t(`${currentStep}.title`)}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t(`${currentStep}.subtitle`)}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {currentStep === "account" && (
              <>
                <div className="space-y-2">
                  <Label>{t("account.displayName")}</Label>
                  <Input
                    {...form.register("displayName")}
                    placeholder={t("account.displayNamePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("account.username")}</Label>
                  <Input
                    {...form.register("username")}
                    onChange={(e) => {
                      form.register("username").onChange(e)
                      checkUsername(e.target.value)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("account.usernameHelper")}
                  </p>
                  {usernameStatus === "available" && (
                    <p className="text-xs text-green-600">
                      {t("username.available", {
                        username: form.getValues("username"),
                      })}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("account.bio")}</Label>
                  <Textarea
                    {...form.register("bio")}
                    placeholder={t("account.bioPlaceholder")}
                    rows={3}
                  />
                </div>
              </>
            )}

            {currentStep === "fiscal" && (
              <>
                <div className="space-y-2">
                  <Label>{t("fiscal.nif")}</Label>
                  <Input {...form.register("nif")} />
                  <p className="text-xs text-muted-foreground">
                    {t("fiscal.nifHelper")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t("fiscal.licenseNumber")}</Label>
                  <Input
                    {...form.register("licenseNumber")}
                    placeholder={t("fiscal.licenseNumberPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("fiscal.languages")}</Label>
                  <div className="flex flex-wrap gap-3">
                    {supportedLanguages.map((lang) => (
                      <label key={lang} className="flex items-center gap-2">
                        <Checkbox
                          checked={form.watch("languages").includes(lang)}
                          onCheckedChange={(checked) => {
                            const current = form.getValues("languages")
                            form.setValue(
                              "languages",
                              checked
                                ? [...current, lang]
                                : current.filter((l) => l !== lang)
                            )
                          }}
                        />
                        <span className="text-sm">{lang.toUpperCase()}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("fiscal.countries")}</Label>
                  <div className="flex flex-wrap gap-3">
                    {supportedCountries.map((country) => (
                      <label key={country} className="flex items-center gap-2">
                        <Checkbox
                          checked={form
                            .watch("practiceCountries")
                            .includes(country)}
                          onCheckedChange={(checked) => {
                            const current = form.getValues("practiceCountries")
                            form.setValue(
                              "practiceCountries",
                              checked
                                ? [...current, country]
                                : current.filter((c) => c !== country)
                            )
                          }}
                        />
                        <span className="text-sm">{country}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {currentStep === "categories" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t("categories.limitHelper", {
                    selected: form.watch("categorySlugs").length,
                    max: 3,
                  })}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {categories.length === 0 ? (
                    <p className="col-span-full text-sm text-muted-foreground">
                      {t("categories.empty")}
                    </p>
                  ) : (
                    categories.map((cat) => (
                      <label
                        key={cat.slug}
                        className="flex items-center gap-2 rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/40"
                      >
                        <Checkbox
                          checked={form
                            .watch("categorySlugs")
                            .includes(cat.slug)}
                          onCheckedChange={(checked) => {
                            const current = form.getValues("categorySlugs")
                            if (checked && current.length >= 3) return
                            form.setValue(
                              "categorySlugs",
                              checked
                                ? [...current, cat.slug]
                                : current.filter((s) => s !== cat.slug)
                            )
                          }}
                        />
                        <span className="text-sm">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {currentStep === "documents" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("documents.subtitle")}
                </p>
                <p className="text-xs text-amber-600">
                  Document upload will be available in the next sprint.
                </p>
              </div>
            )}

            {currentStep === "review" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("review.subtitle")}
                </p>
                <div className="rounded-lg border border-border/60 p-4 text-sm">
                  <p>
                    <strong>Name:</strong> {form.getValues("displayName")}
                  </p>
                  <p>
                    <strong>Username:</strong> {form.getValues("username")}
                  </p>
                  <p>
                    <strong>Languages:</strong>{" "}
                    {form.getValues("languages").join(", ")}
                  </p>
                  <p>
                    <strong>Countries:</strong>{" "}
                    {form.getValues("practiceCountries").join(", ")}
                  </p>
                  <p>
                    <strong>Specialties:</strong>{" "}
                    {form.getValues("categorySlugs").join(", ")}
                  </p>
                </div>
                <label className="flex items-start gap-2">
                  <Checkbox
                    checked={form.watch("consent")}
                    onCheckedChange={(checked) =>
                      form.setValue("consent", !!checked)
                    }
                  />
                  <span className="text-sm">{t("review.consentLabel")}</span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="ghost"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ArrowLeft className="size-4" />
                {t("../common.back")}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={() =>
                    setStep((s) => Math.min(STEPS.length - 1, s + 1))
                  }
                >
                  {t("../common.continue")}
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isPending || !form.watch("consent")}
                >
                  {isPending ? t("review.submitting") : t("review.submitCta")}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
