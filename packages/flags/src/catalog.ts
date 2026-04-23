/**
 * Eleva v3 feature-flag catalog \u2014 source of truth in code, mirrored to
 * Vercel Edge Config by the infra/flags/* files and the flags:sync
 * script. Defaults defined here are the safe fallback when Edge Config
 * is unreachable (per feature-flag-rollout-plan.md).
 *
 * Adding a flag:
 *   1. Append an entry here with owner + default + kill-switch text.
 *   2. Update infra/flags/production.json + staging.json defaults.
 *   3. Land an ADR if the flag gates a launch-sensitive feature.
 *
 * Retiring a flag:
 *   1. Remove all consumers.
 *   2. Remove the entry from this catalog + Edge Config.
 *   3. Delete the kill-switch branch in the relevant code path.
 */

export type FlagScope = "global" | "user" | "org" | "cohort"
export type RolloutStage =
  | "dev-only"
  | "internal-staff"
  | "pilot-cohort"
  | "staged-rollout"
  | "default-on"
  | "cleanup"

export interface FlagEntry {
  name: string
  purpose: string
  owner: "platform" | "commercial" | "payments" | "product"
  scope: FlagScope
  /** Default applied when Edge Config has no override and cannot be reached. */
  default: boolean
  rolloutStage: RolloutStage
  killSwitchBehavior: string
  /** ISO date (yyyy-mm-dd); undefined for evergreen flags. */
  cleanupTarget?: string
  /** Other flag names that must evaluate on before this one is read. */
  dependsOn?: string[]
}

export const FLAG_CATALOG = {
  "ff.clinic_subscription_tiers": {
    name: "ff.clinic_subscription_tiers",
    purpose: "Enable clinic per-seat SaaS monetization (Starter / Growth).",
    owner: "commercial",
    scope: "global",
    default: true,
    rolloutStage: "default-on",
    killSwitchBehavior:
      "Hide clinic signup; existing clinics continue but cannot add seats.",
  },
  "ff.three_party_revenue": {
    name: "ff.three_party_revenue",
    purpose: "Phase-2 overlay: commission on top of clinic SaaS.",
    owner: "commercial",
    scope: "org",
    default: false,
    rolloutStage: "dev-only",
    killSwitchBehavior: "No-op; commission split path never runs.",
  },
  "ff.sms_enabled": {
    name: "ff.sms_enabled",
    purpose: "Global SMS channel toggle (Twilio).",
    owner: "platform",
    scope: "cohort",
    default: true,
    rolloutStage: "pilot-cohort",
    killSwitchBehavior: "Fall back to email-only reminders.",
  },
  "ff.mbway_enabled": {
    name: "ff.mbway_enabled",
    purpose: "MB WAY availability at checkout.",
    owner: "payments",
    scope: "cohort",
    default: true,
    rolloutStage: "pilot-cohort",
    killSwitchBehavior: "Dynamic Payment Methods drops MB WAY from the list.",
  },
  "ff.ai_reports_beta": {
    name: "ff.ai_reports_beta",
    purpose: "AI-assisted post-session report drafting.",
    owner: "product",
    scope: "org",
    default: false,
    rolloutStage: "dev-only",
    killSwitchBehavior:
      "AI draft UI hidden; expert still writes manual reports; transcripts unaffected.",
  },
  "ff.diary_share": {
    name: "ff.diary_share",
    purpose: "Patient \u2192 expert diary sharing.",
    owner: "product",
    scope: "org",
    default: false,
    rolloutStage: "dev-only",
    killSwitchBehavior: "Sharing UI hidden; previous shares remain readable.",
  },
  "ff.toconline_invoicing_enabled": {
    name: "ff.toconline_invoicing_enabled",
    purpose:
      "Tier 1 TOConline invoice automation (Eleva \u2192 Expert/Clinic).",
    owner: "payments",
    scope: "global",
    default: false,
    rolloutStage: "staged-rollout",
    killSwitchBehavior:
      "Skip issuePlatformFeeInvoice step; backfill on re-enable.",
  },
  "ff.expert_invoicing_apps_enabled": {
    name: "ff.expert_invoicing_apps_enabled",
    purpose: "Tier 2 expert \u2192 patient invoice registry globally enabled.",
    owner: "payments",
    scope: "global",
    default: false,
    rolloutStage: "dev-only",
    killSwitchBehavior: "Tier 2 adapter registry quiet; no invoices fire.",
  },
  "ff.invoicing.toconline": {
    name: "ff.invoicing.toconline",
    purpose: "Tier 2 TOConline expert-side adapter.",
    owner: "payments",
    scope: "user",
    default: false,
    rolloutStage: "dev-only",
    killSwitchBehavior:
      "Hide provider from install UI; existing connections read-only.",
    dependsOn: ["ff.expert_invoicing_apps_enabled"],
  },
  "ff.invoicing.moloni": {
    name: "ff.invoicing.moloni",
    purpose: "Tier 2 Moloni adapter.",
    owner: "payments",
    scope: "user",
    default: false,
    rolloutStage: "dev-only",
    killSwitchBehavior:
      "Hide provider from install UI; existing connections read-only.",
    dependsOn: ["ff.expert_invoicing_apps_enabled"],
  },
} as const satisfies Record<string, FlagEntry>

export type FlagName = keyof typeof FLAG_CATALOG

export function catalogNames(): FlagName[] {
  return Object.keys(FLAG_CATALOG) as FlagName[]
}

export function defaultsMap(): Record<FlagName, boolean> {
  const out = {} as Record<FlagName, boolean>
  for (const [name, entry] of Object.entries(FLAG_CATALOG)) {
    out[name as FlagName] = entry.default
  }
  return out
}
