"use client"

import Image from "next/image"
import { CameraIcon, CheckCircleIcon, PlusIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"
import { PEXELS } from "@/domains/expert-onboarding/lib/assets"

interface MockPhotoUploaderProps {
  photos: string[]
  onChange: (photos: string[]) => void
  min?: number
  className?: string
}

export function MockPhotoUploader({
  photos,
  onChange,
  min = 5,
  className,
}: MockPhotoUploaderProps) {
  const addPhoto = () => {
    const next = PEXELS.gallery[photos.length % PEXELS.gallery.length]!
    if (photos.length < 8) onChange([...photos, next])
  }

  const slots = Math.max(min, photos.length + 1)

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Profile & session photos</p>
        <span
          className={cn(
            "text-xs tabular-nums",
            photos.length >= min ? "text-emerald-600" : "text-muted-foreground"
          )}
        >
          {photos.length} / {min} minimum
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: slots }).map((_, i) => {
          const src = photos[i]
          if (src) {
            return (
              <button
                key={src}
                type="button"
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl ring-2 ring-eleva-primary/30"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="200px"
                />
                {i === 0 ? (
                  <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                    Cover
                  </span>
                ) : null}
              </button>
            )
          }
          return (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={addPhoto}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 text-muted-foreground transition-colors hover:border-eleva-primary/40 hover:bg-eleva-primary/5 hover:text-eleva-primary"
            >
              {photos.length === 0 && i === 0 ? (
                <CameraIcon className="size-8" weight="duotone" />
              ) : (
                <PlusIcon className="size-6" />
              )}
              <span className="text-xs">Add photo</span>
            </button>
          )
        })}
      </div>
      {photos.length >= min ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600">
          <CheckCircleIcon className="size-4" weight="fill" />
          Great — members love seeing your space and approach.
        </p>
      ) : null}
    </div>
  )
}
