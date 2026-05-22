import type { ElevaIconWeight } from "./icon"

/** Default Phosphor weight for sidebar nav (inactive). */
export const NAV_ICON_WEIGHT_DEFAULT: ElevaIconWeight = "light"

/** Pointer hover on sidebar nav (between idle and active). */
export const NAV_ICON_WEIGHT_HOVER: ElevaIconWeight = "regular"

/** Active sidebar nav — duotone reads well at 20px (Phosphor showcase). */
export const NAV_ICON_WEIGHT_ACTIVE: ElevaIconWeight = "duotone"

/** Active nav when prefers-reduced-motion (no duotone morph). */
export const NAV_ICON_WEIGHT_REDUCED_ACTIVE: ElevaIconWeight = "fill"

/** shadcn chrome (chevrons, checks, close). */
export const CHROME_ICON_WEIGHT: ElevaIconWeight = "regular"

/** Marketing / empty-state illustrations. */
export const ILLUSTRATION_ICON_WEIGHT: ElevaIconWeight = "duotone"

export const DUOTONE_SECONDARY_COLOR = "rgb(var(--eleva-primary-light))"
