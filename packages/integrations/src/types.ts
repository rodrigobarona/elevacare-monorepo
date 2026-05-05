/**
 * Integration registry types.
 *
 * These types define the catalog layer -- what the expert browses and
 * installs. They are intentionally decoupled from the operational
 * adapter interfaces (CalendarAdapter, ExpertInvoicingAdapter) which
 * live in their respective domain packages.
 */

export type IntegrationCategory =
  | "calendar"
  | "invoicing"
  | "crm"
  | "video"
  | "other"

export type ConnectType = "pipes" | "oauth" | "api_key" | "manual"

export interface IntegrationManifest {
  /** Globally unique slug across all categories. Matches expert_integrations.slug. */
  slug: string
  category: IntegrationCategory
  displayName: string
  /** Asset path or Lucide icon name. */
  icon: string
  publisher: string
  /** ISO-3166-1 alpha-2 country codes. Empty array = worldwide. */
  countries: string[]
  connectType: ConnectType
  description: { en: string; pt: string; es: string }
  docsUrl?: string
  /** WorkOS Pipes provider slug. Required when connectType = "pipes". */
  pipesProvider?: string
  /** Feature flag slug gating visibility. */
  featureFlag?: string
}
