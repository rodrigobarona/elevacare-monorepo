import type { SVGProps } from "react"
import { cn } from "@eleva/ui/lib/utils"
import {
  ELEVA_LOGOTYPE,
  ELEVA_MARK,
  VERIFIED_BADGE,
} from "@eleva/ui/lib/brand-paths"

type BrandSvgProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "children"> & {
  /** Accessible name. Omit only when adjacent text already names the brand. */
  title?: string
}

function a11yProps(title: string | undefined) {
  return title
    ? ({ role: "img", "aria-label": title } as const)
    : ({ "aria-hidden": true } as const)
}

/** Full Eleva Care logotype (mark + wordmark). Inherits `currentColor`. */
export function Logo({
  title = "Eleva Care",
  className,
  ...props
}: BrandSvgProps) {
  return (
    <svg
      viewBox={ELEVA_LOGOTYPE.viewBox}
      fill="currentColor"
      className={cn("h-7 w-auto text-primary", className)}
      {...a11yProps(title)}
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d={ELEVA_LOGOTYPE.markPath} />
      <path d={ELEVA_LOGOTYPE.textPath} />
    </svg>
  )
}

/** Circular Eleva emblem for avatars, app icons and compact headers. */
export function LogoMark({
  title = "Eleva Care",
  className,
  ...props
}: BrandSvgProps) {
  return (
    <svg
      viewBox={ELEVA_MARK.viewBox}
      fill="currentColor"
      className={cn("size-8 text-primary", className)}
      {...a11yProps(title)}
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d={ELEVA_MARK.path} />
    </svg>
  )
}

/** Verified-expert seal. Pass a localized `title` unless the label is visible. */
export function VerifiedBadge({ title, className, ...props }: BrandSvgProps) {
  return (
    <svg
      viewBox={VERIFIED_BADGE.viewBox}
      fill="currentColor"
      className={cn("size-4 shrink-0 text-primary", className)}
      {...a11yProps(title)}
      {...props}
    >
      <path d={VERIFIED_BADGE.path} />
    </svg>
  )
}
