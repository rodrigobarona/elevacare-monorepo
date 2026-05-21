"use client"

import type { CSSProperties } from "react"
import type {
  IconProps as PhosphorIconProps,
  Icon,
} from "@phosphor-icons/react/lib"

export type ElevaIconWeight = PhosphorIconProps["weight"]

export interface ElevaIconProps extends Omit<PhosphorIconProps, "ref"> {
  icon: Icon
  /** Secondary duotone layer — applied via CSS (Phosphor has no duotoneColor prop). */
  duotoneColor?: string
}

const DEFAULT_DUOTONE_SECONDARY = "rgb(var(--eleva-primary-light))"

/** Phosphor duotone secondary paths use opacity 0.2; restyle without invalid DOM attrs. */
const DUOTONE_SECONDARY_CLASS =
  "[&_path[opacity='0.2']]:opacity-100 [&_path[opacity='0.2']]:fill-[var(--eleva-duotone-secondary)]"

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

/**
 * Eleva-branded Phosphor icon wrapper. Use semantic Tailwind on `className` for
 * mono weights; pass `duotoneColor` for the secondary duotone layer (sidebar, marketing).
 */
export function ElevaIcon({
  icon: IconComponent,
  weight = "regular",
  duotoneColor = DEFAULT_DUOTONE_SECONDARY,
  className,
  style,
  ...props
}: ElevaIconProps) {
  const isDuotone = weight === "duotone"

  return (
    <IconComponent
      weight={weight}
      className={cn(className, isDuotone && DUOTONE_SECONDARY_CLASS)}
      style={
        isDuotone
          ? ({
              ...style,
              ["--eleva-duotone-secondary" as string]: duotoneColor,
            } as CSSProperties)
          : style
      }
      {...props}
    />
  )
}
