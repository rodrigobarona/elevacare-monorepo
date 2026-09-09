"use client"

import Image from "next/image"
import { cn } from "@eleva/ui/lib/utils"

interface PhaseInterstitialProps {
  stepLabel: string
  title: string
  body: string
  illustration?: string
}

export function PhaseInterstitial({
  stepLabel,
  title,
  body,
  illustration,
}: PhaseInterstitialProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 sm:py-16">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-muted-foreground">
            {stepLabel}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            {body}
          </p>
        </div>
      </div>
      {illustration ? (
        <div className="relative hidden flex-1 lg:block">
          <div className="flex h-full items-center justify-center p-10">
            <div className="relative aspect-[4/3] w-full max-w-lg overflow-hidden rounded-3xl">
              <Image
                src={illustration}
                alt=""
                fill
                className="object-cover"
                sizes="500px"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface PhaseInterstitialContentProps {
  stepLabel: string
  title: string
  body: string
  className?: string
}

export function PhaseInterstitialContent({
  stepLabel,
  title,
  body,
  className,
}: PhaseInterstitialContentProps) {
  return (
    <div className={cn("max-w-xl", className)}>
      <p className="text-sm font-medium text-muted-foreground">{stepLabel}</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  )
}
