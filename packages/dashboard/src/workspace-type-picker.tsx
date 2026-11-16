"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { cn } from "@eleva/ui/lib/utils"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { BookOpenIcon, UserIcon, UsersIcon } from "@eleva/icons"
import { ElevaIcon } from "@eleva/icons/client"
import type { ExistingPractice } from "./existing-practice"
import { gatewayUrl } from "./gateway-url"

const workspaceTypes = [
  { type: "expert", icon: UserIcon },
  { type: "team", icon: UsersIcon },
  { type: "academy", icon: BookOpenIcon },
] as const

type WorkspaceType = (typeof workspaceTypes)[number]["type"]

interface WorkspaceTypePickerProps {
  mode: "page" | "modal"
  existingPractice?: ExistingPractice | null
}

function navigateToGatewayPath(path: string) {
  const href = gatewayUrl(path)
  if (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    typeof document.startViewTransition === "function"
  ) {
    document.startViewTransition(() => {
      window.location.assign(href)
    })
    return
  }
  window.location.assign(href)
}

export function WorkspaceTypePicker({
  mode,
  existingPractice,
}: WorkspaceTypePickerProps) {
  const t = useTranslations("createWorkspace")
  const [selected, setSelected] = React.useState<WorkspaceType | null>(null)

  const continuePath = selected
    ? `/account/workspaces/create/${selected}`
    : undefined

  const handleContinue = () => {
    if (!continuePath) return
    navigateToGatewayPath(continuePath)
  }

  const isModal = mode === "modal"

  return (
    <div className={cn(isModal ? "space-y-8" : "space-y-6")}>
      <div className={cn("grid sm:grid-cols-3", isModal ? "gap-6" : "gap-4")}>
        {workspaceTypes.map(({ type, icon }) => {
          const isSelected = selected === type
          const practice = type === "expert" ? existingPractice : null
          const cardClass = cn(
            "flex flex-col rounded-2xl border transition-colors",
            isModal
              ? "items-center gap-6 p-8 text-center"
              : "items-start gap-4 p-5 text-left",
            isSelected
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border hover:border-primary/40 hover:bg-accent/40"
          )
          // One practice per person: the card opens the one they have
          // instead of starting a second setup.
          if (practice) {
            return (
              <a
                key={type}
                href={practice.href}
                data-testid="workspace-type-expert-existing"
                className={cardClass}
              >
                {isModal ? (
                  <ElevaIcon
                    icon={icon}
                    weight="duotone"
                    className="size-20 text-primary"
                  />
                ) : (
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-muted">
                    <ElevaIcon
                      icon={icon}
                      weight="duotone"
                      className="size-6 text-primary"
                    />
                  </span>
                )}
                <span className={cn("space-y-2", isModal && "max-w-[14rem]")}>
                  <span className="block text-base font-medium">
                    {t(`types.${type}.title`)}
                  </span>
                  <span className="block text-sm leading-relaxed text-muted-foreground">
                    {t("types.expert.existingDescription", {
                      name: practice.name,
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    {t("types.expert.open")}
                    <span aria-hidden="true">→</span>
                  </span>
                </span>
              </a>
            )
          }
          return (
            <button
              key={type}
              type="button"
              onClick={() => setSelected(type)}
              className={cardClass}
            >
              {isModal ? (
                <ElevaIcon
                  icon={icon}
                  weight={isSelected ? "fill" : "duotone"}
                  className="size-20 text-primary"
                />
              ) : (
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-muted">
                  <ElevaIcon
                    icon={icon}
                    weight={isSelected ? "fill" : "duotone"}
                    className="size-6 text-primary"
                  />
                </span>
              )}
              <span className={cn("space-y-2", isModal && "max-w-[14rem]")}>
                <span className="block text-base font-medium">
                  {t(`types.${type}.title`)}
                </span>
                <span className="block text-sm leading-relaxed text-muted-foreground">
                  {t(`types.${type}.description`)}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div
        className={cn(
          "flex justify-end gap-3",
          isModal && "border-t border-border pt-6"
        )}
      >
        {mode === "page" ? (
          <LinkButton variant="outline" href="/account/organizations">
            {t("cancel")}
          </LinkButton>
        ) : null}
        <Button type="button" isDisabled={!selected} onPress={handleContinue}>
          {t("continue")}
        </Button>
      </div>
    </div>
  )
}
