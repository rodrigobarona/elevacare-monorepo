"use client"

import * as React from "react"
import Link from "next/link"
import { BookOpenIcon, UserIcon, UsersIcon } from "@eleva/icons"
import { ElevaIcon } from "@eleva/icons/client"
import { Button } from "@eleva/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@eleva/ui/components/dialog"
import { cn } from "@eleva/ui/lib/utils"

const workspaceTypes = [
  {
    type: "expert" as const,
    icon: UserIcon,
    title: "Expert",
    description: "Run your independent practice on Eleva.",
  },
  {
    type: "team" as const,
    icon: UsersIcon,
    title: "Team",
    description: "Manage multiple experts under one organization.",
  },
  {
    type: "academy" as const,
    icon: BookOpenIcon,
    title: "Academy",
    description: "Publish and manage courses for your learners.",
  },
]

interface CreateWorkspaceModalMockProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExpertContinue: () => void
}

export function CreateWorkspaceModalMock({
  open,
  onOpenChange,
  onExpertContinue,
}: CreateWorkspaceModalMockProps) {
  const [selected, setSelected] = React.useState<
    "expert" | "team" | "academy" | null
  >(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-8 p-8 sm:max-w-4xl">
        <DialogHeader className="items-center text-center sm:pr-0">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Create a workspace
          </DialogTitle>
          <DialogDescription className="text-base">
            Choose the type of workspace you want to create.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-3">
          {workspaceTypes.map(({ type, icon, title, description }) => {
            const isSelected = selected === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setSelected(type)}
                className={cn(
                  "flex flex-col items-center gap-6 rounded-2xl border p-8 text-center transition-all duration-200",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-lg ring-2 shadow-primary/5 ring-primary/20"
                    : "border-border hover:border-primary/40 hover:bg-accent/40"
                )}
              >
                <ElevaIcon
                  icon={icon}
                  weight={isSelected ? "fill" : "duotone"}
                  className="size-20 text-eleva-primary"
                  duotoneColor="rgb(var(--eleva-primary-light))"
                />
                <span className="max-w-[14rem] space-y-2">
                  <span className="block text-base font-medium">{title}</span>
                  <span className="block text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selected !== "expert"}
            onClick={() => {
              if (selected === "expert") {
                onOpenChange(false)
                onExpertContinue()
              }
            }}
          >
            Continue
          </Button>
        </div>
        {selected && selected !== "expert" ? (
          <p className="text-center text-xs text-muted-foreground">
            This POC demo covers the Expert path only.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** Simulated product chrome with org switcher trigger */
export function MockAppShell({
  children,
  onCreateWorkspace,
}: {
  children: React.ReactNode
  onCreateWorkspace: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            eleva<span className="text-eleva-primary">.care</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCreateWorkspace}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              Create workspace
            </button>
            <div className="size-8 rounded-full bg-gradient-to-br from-eleva-primary/30 to-eleva-primary/60" />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
