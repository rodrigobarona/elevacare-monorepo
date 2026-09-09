"use client"

import Image from "next/image"
import { cn } from "@eleva/ui/lib/utils"

interface ChapterCoverProps {
  eyebrow: string
  title: string
  body: string
  illustration?: string
  chapterIndex?: number
  className?: string
}

export function ChapterCover({
  eyebrow,
  title,
  body,
  illustration,
  chapterIndex,
  className,
}: ChapterCoverProps) {
  return (
    <div
      className={cn(
        "flex min-h-[min(100%,720px)] flex-1 flex-col bg-gradient-to-br from-stone-100 via-stone-50 to-eleva-primary/5 lg:min-h-0 lg:flex-row",
        className
      )}
    >
      <div className="flex flex-1 flex-col justify-center px-6 py-14 sm:px-12 sm:py-20 lg:px-16">
        <div className="mx-auto w-full max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-eleva-primary/20 bg-background/80 px-4 py-1.5 text-sm font-medium text-eleva-primary shadow-sm backdrop-blur-sm">
            {chapterIndex != null ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-eleva-primary text-xs font-semibold text-primary-foreground">
                {chapterIndex}
              </span>
            ) : null}
            <span>{eyebrow}</span>
          </div>
          <p className="mt-6 text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Chapter overview
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.1] lg:text-[3.25rem]">
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl sm:leading-relaxed">
            {body}
          </p>
          <p className="mt-10 text-sm text-muted-foreground">
            No answers on this screen — tap Continue when you&apos;re ready for
            the questions.
          </p>
        </div>
      </div>
      {illustration ? (
        <div className="relative flex flex-1 items-end justify-center p-6 sm:p-10 lg:items-center lg:p-12">
          <div className="relative aspect-[4/3] w-full max-w-xl overflow-hidden rounded-3xl shadow-2xl ring-1 ring-black/5 lg:max-w-2xl">
            <Image
              src={illustration}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 640px"
              priority
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
