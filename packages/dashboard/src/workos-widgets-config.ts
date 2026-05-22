import type { WorkOsWidgetsProps } from "@workos-inc/widgets"

export type ElevaWorkOsAppearance = "light" | "dark"

/** Wrapper class for scoped WorkOS widget CSS overrides. */
export const ELEVA_WORKOS_WRAPPER_CLASS = "eleva-workos-widgets"

export type ElevaWorkOsTheme = NonNullable<WorkOsWidgetsProps["theme"]>

export type ElevaWorkOsElements = NonNullable<WorkOsWidgetsProps["elements"]>

/** Radix theme props shared across all WorkOS widget surfaces. */
export function getElevaWorkOsTheme(options?: {
  appearance?: ElevaWorkOsAppearance
}): ElevaWorkOsTheme {
  return {
    accentColor: "teal",
    grayColor: "slate",
    radius: "full",
    fontFamily: "inherit",
    ...(options?.appearance ? { appearance: options.appearance } : {}),
  }
}

/** Per-component Radix overrides for WorkOS widget internals. */
export const elevaWorkOsElements: ElevaWorkOsElements = {
  primaryButton: {
    variant: "solid",
    highContrast: false,
    radius: "full",
    size: "2",
  },
  secondaryButton: {
    variant: "outline",
    color: "gray",
    radius: "full",
    size: "2",
  },
  destructiveButton: {
    variant: "solid",
    color: "red",
    radius: "full",
    size: "2",
  },
  textfield: {
    variant: "surface",
    radius: "medium",
    size: "2",
  },
  select: {
    variant: "surface",
    radius: "medium",
  },
  dialog: {
    maxWidth: "480px",
    size: "3",
  },
}
