"use client"

import { cn } from "@eleva/ui/lib/utils"

interface PricingPreviewProps {
  memberPrice: number
  className?: string
}

export function PricingPreview({
  memberPrice,
  className,
}: PricingPreviewProps) {
  const platformFee = Math.round(memberPrice * 0.2 * 100) / 100
  const earnings = Math.round((memberPrice - platformFee) * 100) / 100

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-background p-5",
        className
      )}
    >
      <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Earnings preview
      </p>
      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Member pays</span>
          <span className="font-medium tabular-nums">
            €{memberPrice.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Platform fee (20%)</span>
          <span className="text-muted-foreground tabular-nums">
            −€{platformFee.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between border-t border-border/60 pt-2 text-base">
          <span className="font-medium">You receive</span>
          <span className="font-semibold text-eleva-primary tabular-nums">
            €{earnings.toFixed(2)}
          </span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Community Expert rate shown. Top Experts qualify for reduced fees.
      </p>
    </div>
  )
}
