import type { Icon } from "@phosphor-icons/react/lib"

/**
 * Client Phosphor icons for nav — registry is only consumed via `@eleva/icons/client`.
 * Do not use SSR icons here; duotone styling is applied in ElevaIcon via CSS.
 */
import {
  BookOpenIcon,
  BuildingsIcon,
  CalendarDotsIcon,
  CalendarIcon,
  ChartBarIcon,
  ClockIcon,
  CreditCardIcon,
  GearIcon,
  PlugIcon,
  ShieldIcon,
  SquaresFourIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "@phosphor-icons/react"

/** Serializable nav icon keys — safe to pass from Server Components. */
export const NAV_ICON_NAMES = [
  "SquaresFourIcon",
  "UserIcon",
  "CreditCardIcon",
  "BuildingsIcon",
  "ShieldIcon",
  "GearIcon",
  "UsersIcon",
  "CalendarDotsIcon",
  "ClockIcon",
  "CalendarIcon",
  "PlugIcon",
  "WalletIcon",
  "BookOpenIcon",
  "ChartBarIcon",
] as const

export type NavIconName = (typeof NAV_ICON_NAMES)[number]

export const navIconRegistry: Record<NavIconName, Icon> = {
  SquaresFourIcon,
  UserIcon,
  CreditCardIcon,
  BuildingsIcon,
  ShieldIcon,
  GearIcon,
  UsersIcon,
  CalendarDotsIcon,
  ClockIcon,
  CalendarIcon,
  PlugIcon,
  WalletIcon,
  BookOpenIcon,
  ChartBarIcon,
}

export function getNavIcon(name: NavIconName): Icon {
  return navIconRegistry[name]
}
