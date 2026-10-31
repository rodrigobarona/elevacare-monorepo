import type * as React from "react"
import { cn } from "@eleva/ui/lib/utils"

/**
 * Inset, rounded hero with a full-bleed media layer (video or image) under a
 * legibility scrim. Text sits bottom-left so faces in the media stay visible.
 * `aside` adds a column of tiles beside the hero on large screens.
 */
function MediaHero({
  media,
  aside,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"section">, "children"> & {
  media: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  const hero = (
    <section
      data-slot="media-hero"
      className={cn(
        "relative isolate overflow-hidden rounded-3xl bg-teal-950 text-white lg:rounded-4xl",
        !aside && "m-2 sm:m-3",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 -z-10 *:size-full [&_img]:object-cover [&_video]:object-cover">
        {media}
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-t from-teal-950/85 via-teal-950/35 to-transparent"
      />
      {aside ? (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-linear-to-r from-teal-950/75 via-teal-950/30 to-transparent"
        />
      ) : null}
      <div className="mx-auto flex min-h-[36rem] max-w-7xl flex-col justify-end gap-8 px-5 pt-40 pb-12 sm:px-8 lg:min-h-[44rem] lg:pb-20">
        {children}
      </div>
    </section>
  )

  if (!aside) return hero

  return (
    <div className="m-2 grid gap-2 sm:m-3 sm:gap-3 lg:grid-cols-[1.8fr_1fr]">
      {hero}
      <div className="hidden grid-rows-2 gap-3 lg:grid">{aside}</div>
    </div>
  )
}

function MediaHeroActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="media-hero-actions"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center",
        className
      )}
      {...props}
    />
  )
}

export { MediaHero, MediaHeroActions }
