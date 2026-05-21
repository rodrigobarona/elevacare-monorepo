import type { ElevaIconWeight } from "./icon"
import {
  NAV_ICON_WEIGHT_ACTIVE,
  NAV_ICON_WEIGHT_DEFAULT,
  NAV_ICON_WEIGHT_HOVER,
  NAV_ICON_WEIGHT_REDUCED_ACTIVE,
} from "./presets"

export function resolveNavIconWeight(
  active: boolean,
  hovered: boolean,
  prefersReducedMotion: boolean
): ElevaIconWeight {
  if (prefersReducedMotion) {
    return active ? NAV_ICON_WEIGHT_REDUCED_ACTIVE : NAV_ICON_WEIGHT_DEFAULT
  }
  if (active) return NAV_ICON_WEIGHT_ACTIVE
  if (hovered) return NAV_ICON_WEIGHT_HOVER
  return NAV_ICON_WEIGHT_DEFAULT
}
