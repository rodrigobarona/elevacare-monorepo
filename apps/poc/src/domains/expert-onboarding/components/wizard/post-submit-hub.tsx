"use client"

import {
  RocketLaunchIcon,
  CalendarIcon,
  GlobeIcon,
  ShieldIcon,
} from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import type { ExpertDraft } from "@/domains/expert-onboarding/lib/types"

interface PostSubmitHubProps {
  draft: ExpertDraft
}

export function PostSubmitHub({ draft }: PostSubmitHubProps) {
  const tasks = [
    {
      icon: ShieldIcon,
      title: "Verification in progress",
      body: "Eleva is reviewing your credentials for Portugal. Usually 1–2 business days.",
      done: false,
    },
    {
      icon: CalendarIcon,
      title: "Connect your calendar",
      body: "Members can book when your availability is synced.",
      done: false,
    },
    {
      icon: GlobeIcon,
      title: "Share your profile",
      body: `Preview ${draft.workspaceName || "your workspace"} when verification completes.`,
      done: false,
    },
  ]

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <RocketLaunchIcon
        className="size-14 text-eleva-primary"
        weight="duotone"
      />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Request sent
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        We&apos;ll email you when {draft.workspaceName || "your workspace"} is
        ready for members. Complete these steps while you wait.
      </p>
      <ul className="mt-10 w-full max-w-lg space-y-4 text-left">
        {tasks.map((task) => (
          <li
            key={task.title}
            className="flex gap-4 rounded-2xl border border-border/60 bg-background p-5"
          >
            <task.icon
              className="size-6 shrink-0 text-eleva-primary"
              weight="duotone"
            />
            <div>
              <p className="font-medium">{task.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{task.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <Button className="mt-10" variant="outline" asChild>
        <a href="/">Back to gallery</a>
      </Button>
    </div>
  )
}
