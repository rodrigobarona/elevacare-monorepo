"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { cn } from "@eleva/ui/lib/utils"
import { Button } from "@eleva/ui/components/button"
import { BookOpenIcon, UserIcon, UsersIcon } from "@eleva/icons"
import { ElevaIcon } from "@eleva/icons/client"
import { gatewayUrl } from "./gateway-url"

const workspaceTypes = [
  { type: "expert", icon: UserIcon },
  { type: "team", icon: UsersIcon },
  { type: "academy", icon: BookOpenIcon },
] as const

type WorkspaceType = (typeof workspaceTypes)[number]["type"]

interface WorkspaceTypePickerProps {
  mode: "page" | "modal"
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

export function WorkspaceTypePicker({ mode }: WorkspaceTypePickerProps) {
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
          return (
            <button
              key={type}
              type="button"
              onClick={() => setSelected(type)}
              className={cn(
                "flex flex-col rounded-2xl border transition-colors",
                isModal
                  ? "items-center gap-6 p-8 text-center"
                  : "items-start gap-4 p-5 text-left",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40 hover:bg-accent/40"
              )}
            >
              {isModal ? (
                <ElevaIcon
                  icon={icon}
                  weight="duotone"
                  className={cn(
                    "size-20 text-primary transition-transform duration-200",
                    isSelected && "scale-105"
                  )}
                />
              ) : (
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-muted text-primary">
                  <ElevaIcon icon={icon} weight="duotone" className="size-6" />
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
          <Button type="button" variant="outline" asChild>
            <Link href="/account/organizations">{t("cancel")}</Link>
          </Button>
        ) : null}
        <Button type="button" disabled={!selected} onClick={handleContinue}>
          {t("continue")}
        </Button>
      </div>
    </div>
  )
}
