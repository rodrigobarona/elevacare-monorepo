"use client"

import type { Icon } from "@phosphor-icons/react/lib"

import { ElevaIcon } from "./icon"
import { resolveNavIconWeight } from "./resolve-nav-icon-weight"
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion"

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

export interface NavIconProps {
  icon: Icon
  active?: boolean
  /** Set by parent link on pointer/focus — drives light → regular weight. */
  hovered?: boolean
  className?: string
  size?: number
}

/**
 * Sidebar nav icon — light when idle, regular on hover, duotone when active.
 * Respects prefers-reduced-motion (fill vs light, no scale).
 */
export function NavIcon({
  icon,
  active = false,
  hovered = false,
  className,
  size = 20,
}: NavIconProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const weight = resolveNavIconWeight(active, hovered, prefersReducedMotion)

  return (
    <span
      className={cn(
        "inline-flex shrink-0 transition-[transform,color,opacity] duration-200 ease-out motion-reduce:transition-none",
        !prefersReducedMotion && hovered && !active && "scale-105",
        !prefersReducedMotion && active && "scale-[1.02]",
        className
      )}
    >
      <ElevaIcon
        icon={icon}
        size={size}
        weight={weight}
        className="transition-opacity duration-200 ease-out motion-reduce:transition-none"
        aria-hidden
      />
    </span>
  )
}
