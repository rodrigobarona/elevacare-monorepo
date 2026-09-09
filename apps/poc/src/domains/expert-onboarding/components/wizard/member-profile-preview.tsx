"use client"

import Image from "next/image"
import dynamic from "next/dynamic"
import { MapPinIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"
import { PEXELS } from "@/domains/expert-onboarding/lib/assets"
import { inferLocationMapStage } from "@/lib/map-basemaps"
import {
  COUNTRY_LABELS,
  SPECIALTIES,
  type ExpertDraft,
} from "@/domains/expert-onboarding/lib/types"
import type { PreviewKey } from "@/lib/wizard-types"

const ProgressiveLocationMap = dynamic(
  () =>
    import("@/components/map/progressive-location-map").then(
      (m) => m.ProgressiveLocationMap
    ),
  {
    ssr: false,
    loading: () => <div className="aspect-[16/10] animate-pulse bg-muted" />,
  }
)

interface MemberProfilePreviewProps {
  draft: ExpertDraft
  highlight?: PreviewKey
  className?: string
}

export function MemberProfilePreview({
  draft,
  highlight,
  className,
}: MemberProfilePreviewProps) {
  const specialty = SPECIALTIES.find((s) => s.id === draft.specialty)?.label
  const cover =
    draft.photos[draft.coverPhotoIndex] ??
    draft.photos[0] ??
    PEXELS.heroWellness

  return (
    <div
      className={cn(
        "sticky top-0 flex h-full min-h-[480px] flex-col border-l border-border/40 bg-stone-100/80 p-6 lg:p-8",
        className
      )}
    >
      <p className="mb-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Member preview
      </p>
      <div className="overflow-hidden rounded-3xl border border-border/40 bg-background shadow-sm">
        <div
          className={cn(
            "relative bg-muted transition-opacity",
            highlight === "location" ? "aspect-auto" : "aspect-[16/10]",
            highlight &&
              highlight !== "photos" &&
              highlight !== "full" &&
              highlight !== "location" &&
              "opacity-90"
          )}
        >
          {highlight === "location" ? (
            <ProgressiveLocationMap
              draft={draft}
              stage={inferLocationMapStage(draft)}
              compact
              className="rounded-none border-0"
            />
          ) : (
            <Image
              src={cover}
              alt=""
              fill
              className="object-cover"
              sizes="400px"
            />
          )}
        </div>
        <div className="space-y-3 p-5">
          <p
            className={cn(
              "text-lg font-semibold transition-colors",
              highlight === "headline" && "text-eleva-primary"
            )}
          >
            {draft.headline.en || draft.professionalTitle || "Your headline"}
          </p>
          {specialty ? (
            <p
              className={cn(
                "text-sm text-muted-foreground",
                highlight === "specialty" && "font-medium text-foreground"
              )}
            >
              {specialty}
            </p>
          ) : null}
          <p
            className={cn(
              "flex items-center gap-1 text-sm text-muted-foreground",
              highlight === "location" && "font-medium text-foreground"
            )}
          >
            <MapPinIcon className="size-4" />
            {draft.city || "City"} · {COUNTRY_LABELS[draft.practiceCountry]}
          </p>
          {draft.eventTitle.en ? (
            <div
              className={cn(
                "rounded-xl border border-border/60 p-3",
                highlight === "event" &&
                  "border-eleva-primary/40 bg-eleva-primary/5"
              )}
            >
              <p className="text-sm font-medium">{draft.eventTitle.en}</p>
              <p
                className={cn(
                  "mt-1 text-sm text-muted-foreground",
                  highlight === "price" && "font-semibold text-foreground"
                )}
              >
                €{draft.eventPrice} · {draft.eventDuration} min
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
