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
