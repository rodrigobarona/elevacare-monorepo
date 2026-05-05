"use client"

import * as React from "react"
import { Button } from "@eleva/ui/components/button"
import { Badge } from "@eleva/ui/components/badge"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { saveInvoicingChoice } from "./actions"
import type { OnboardingProfile } from "./onboarding-wizard"

const ADAPTERS = [
  {
    slug: "toconline" as const,
    name: "TOConline",
    description: "Automatic invoicing via TOConline. OAuth connection.",
    installType: "oauth",
    countries: ["PT"],
  },
  {
    slug: "moloni" as const,
    name: "Moloni",
    description: "Automatic invoicing via Moloni. (Coming soon)",
    installType: "oauth",
    countries: ["PT"],
    disabled: true,
  },
  {
    slug: "manual" as const,
    name: "Manual Invoicing",
    description:
      "You handle invoicing yourself outside of Eleva. Acknowledge to proceed.",
    installType: "manual",
    countries: ["PT", "ES", "BR"],
  },
]

interface Props {
  profile: OnboardingProfile
  onDone: () => void
}

export function StepInvoicing({ profile, onDone }: Props) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const alreadyConnected =
    profile.invoicingSetupStatus === "connected" ||
    profile.invoicingSetupStatus === "manual_acknowledged"

  async function handleSelect(slug: "toconline" | "moloni" | "manual") {
    setPending(true)
    setError(null)

    try {
      if (slug === "toconline") {
        const result = await saveInvoicingChoice(slug)
        if (!result.ok) {
          setError(result.error)
          return
        }
        window.location.href = `/expert/onboarding/toconline-redirect`
        return
      }

      const result = await saveInvoicingChoice(slug)
      if (result.ok) {
        onDone()
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save choice")
    } finally {
      setPending(false)
    }
  }

  if (alreadyConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-green-500 text-green-700">
            {profile.invoicingProvider === "manual"
              ? "Acknowledged"
              : "Connected"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Invoicing is set up via <strong>{profile.invoicingProvider}</strong>
            .
          </span>
        </div>
        <Button size="sm" onClick={onDone}>
          Continue
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        Choose how your patient invoices will be issued. You can connect an
        automated provider or handle invoicing manually.
      </p>

      <div className="grid gap-3">
        {ADAPTERS.map((adapter) => (
          <Card
            key={adapter.slug}
            className={adapter.disabled ? "opacity-50" : ""}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{adapter.name}</CardTitle>
                <Badge variant="secondary">
                  {adapter.countries.join(", ")}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {adapter.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                variant={adapter.slug === "manual" ? "outline" : "default"}
                disabled={pending || adapter.disabled}
                onClick={() => handleSelect(adapter.slug)}
              >
                {adapter.slug === "manual"
                  ? "Acknowledge manual invoicing"
                  : adapter.slug === "toconline"
                    ? "Connect TOConline"
                    : "Connect"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
