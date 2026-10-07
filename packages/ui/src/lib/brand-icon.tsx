import { ImageResponse } from "@vercel/og"
import { ELEVA_MARK } from "./brand-paths"

/**
 * Renders the official Eleva.care brand icon at the given size.
 * Uses the BIMI logo emblem (circular with botanical motif).
 */
export function renderBrandIcon(size: number) {
  return new ImageResponse(
    <svg
      width={size}
      height={size}
      viewBox={ELEVA_MARK.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d={ELEVA_MARK.path}
        fill="#11999E"
      />
    </svg>,
    { width: size, height: size }
  )
}
