/**
 * PoC catalog — SSOT for all interactive walkthrough domains in apps/poc.
 */

export type PocDomainStatus = "live" | "planned"
export type PocWalkthroughStatus = "live" | "archived"
export type LabImplementation = "static" | "react"
export type LabPhase = "onboarding" | "setup"

export interface PocWalkthrough {
  id: string
  slug: string
  title: string
  subtitle: string
  tagline: string
  bestFor: string
  stepCount: number | string
  mentalModel: string
  stepsBeforeCompliance: string
  href: string
  specPath: string
  status?: PocWalkthroughStatus
}

export interface LabWalkthrough extends PocWalkthrough {
  mobbinRef: string
  implementation: LabImplementation
  phase: LabPhase
  aestheticTag: string
}

export interface PocDomain {
  id: string
  slug: string
  title: string
  description: string
  status: PocDomainStatus
  href: string
  specPath: string
  walkthroughs: PocWalkthrough[]
  onboardingLabs?: LabWalkthrough[]
  setupLabs?: LabWalkthrough[]
}

const BASE = "/expert-onboarding"
const SPEC = "_context/PoCs/expert-onboarding"

function labMeta(
  id: string,
  slug: string,
  phase: LabPhase,
  title: string,
  subtitle: string,
  tagline: string,
  bestFor: string,
  stepCount: number | string,
  mentalModel: string,
  mobbinRef: string,
  implementation: LabImplementation,
  aestheticTag: string,
  stepsBeforeCompliance: string
): LabWalkthrough {
  const prefix = phase === "onboarding" ? `${BASE}/onboarding` : `${BASE}/setup`
  const href =
    implementation === "static"
      ? `${prefix}/${slug}/index.html`
      : `${prefix}/${slug}`
  return {
    id,
    slug,
    title,
    subtitle,
    tagline,
    bestFor,
    stepCount,
    mentalModel,
    stepsBeforeCompliance,
    href,
    specPath: `${SPEC}/walkthroughs/${phase}-${slug}/readme.md`,
    mobbinRef,
    implementation,
    phase,
    aestheticTag,
  }
}

export const EXPERT_ONBOARDING_LABS: LabWalkthrough[] = [
  labMeta(
    "o1",
    "setup-rail",
    "onboarding",
    "Setup Rail",
    "Remote-style step tracker",
    "Vertical rail: practice → offer → identity → draft saved.",
    "B2B experts",
    4,
    "Remote sidebar",
    "remote.com Web Onboarding",
    "react",
    "B2B utilitarian",
    "Draft handoff"
  ),
  labMeta(
    "o2",
    "focus-sweep",
    "onboarding",
    "Focus Sweep",
    "Fresha one-question sweep",
    "Giant single question + segmented bar.",
    "Mobile-first experts",
    5,
    "Fresha setup",
    "Fresha Web Setting up an account",
    "static",
    "Salon minimal",
    "Draft handoff"
  ),
  labMeta(
    "o3",
    "pitch-split",
    "onboarding",
    "Pitch Split",
    "Attio split-pane",
    "Form left, editorial member story right.",
    "Trust-led experts",
    4,
    "Attio split",
    "Attio Web Onboarding",
    "react",
    "CRM editorial",
    "Draft handoff"
  ),
  labMeta(
    "o4",
    "intent-categories",
    "onboarding",
    "Intent Categories",
    "Hims category-first",
    "Specialty cards → Create Space modal → workspace fields.",
    "Intent capture",
    3,
    "Hims categories",
    "Hims Web Onboarding",
    "static",
    "Telehealth marketing",
    "Draft handoff"
  ),
  labMeta(
    "o5",
    "studio-canvas",
    "onboarding",
    "Studio Canvas",
    "Clay workspace canvas",
    "Design your Space on a creative canvas.",
    "Brand-forward creators",
    1,
    "Clay workspace",
    "Clay Web Onboarding",
    "react",
    "Creative SaaS",
    "Draft handoff"
  ),
  labMeta(
    "o6",
    "path-fork",
    "onboarding",
    "Path Fork",
    "Time2book solo vs clinic",
    "Divergent paths after modal.",
    "Solo vs team",
    "4 each",
    "Time2book fork",
    "Time2book Web Onboarding",
    "react",
    "Booking marketplace",
    "Draft handoff"
  ),
  labMeta(
    "o7",
    "monetize-pick",
    "onboarding",
    "Monetize Pick",
    "Wise tier picker",
    "Tier cards shape workspace questions.",
    "Monetization-first",
    3,
    "Wise Jars",
    "Wise Web Setting up a jar",
    "react",
    "Fintech picker",
    "Draft handoff"
  ),
  labMeta(
    "o8",
    "live-preview",
    "onboarding",
    "Live Preview",
    "PoC B WYSIWYG",
    "Edit left, live member preview right.",
    "Brand-conscious experts",
    4,
    "Split WYSIWYG",
    "PoC B archived",
    "react",
    "Profile builder",
    "Draft handoff"
  ),
  labMeta(
    "o9",
    "event-first",
    "onboarding",
    "Event First",
    "PoC C session-first",
    "Bookable session first, then profile bridge.",
    "Busy clinicians",
    4,
    "Service-first",
    "PoC C archived",
    "react",
    "Session pipeline",
    "Draft handoff"
  ),
  labMeta(
    "o10",
    "guided-prompts",
    "onboarding",
    "Guided Prompts",
    "PoC D prompts",
    "Full-viewport questions + dot footer.",
    "Minimal chrome",
    8,
    "Typeform-style",
    "PoC D archived",
    "react",
    "Focused prompts",
    "Draft handoff"
  ),
]

export const EXPERT_SETUP_LABS: LabWalkthrough[] = [
  labMeta(
    "s1",
    "settings-forge",
    "setup",
    "Settings Forge",
    "Podia / Whop inline",
    "List rows with inline expand editors.",
    "Power users",
    6,
    "Podia settings",
    "Podia + Whop",
    "static",
    "Creator admin",
    "Publish gate"
  ),
  labMeta(
    "s2",
    "dashboard-quest",
    "setup",
    "Dashboard Quest",
    "Shopify overlay",
    "Dashboard + bottom-sheet setup quest.",
    "Product-first experts",
    4,
    "Shopify overlay",
    "Shopify Account Setup",
    "react",
    "E-commerce setup",
    "Publish gate"
  ),
  labMeta(
    "s3",
    "security-mfa",
    "setup",
    "Security MFA",
    "Heidi 2FA setup",
    "Enable authenticator — no OTP onboarding.",
    "Healthcare experts",
    2,
    "Heidi MFA",
    "Heidi Web Setting up 2FA",
    "static",
    "Clinical calm",
    "Publish gate"
  ),
  labMeta(
    "s4",
    "todo-board",
    "setup",
    "Todo Board",
    "Remote kanban todos",
    "Required / Recommended / Done columns.",
    "Visual planners",
    5,
    "Remote todos",
    "remote.com Web Onboarding",
    "react",
    "Kanban",
    "Publish gate"
  ),
  labMeta(
    "s5",
    "compliance-gate",
    "setup",
    "Compliance Gate",
    "Country final gate",
    "PT/ES/BR license, NIF, terms.",
    "Compliance-sensitive",
    1,
    "Country gate",
    "country-requirements.md",
    "react",
    "Regulatory",
    "Publish gate"
  ),
  labMeta(
    "s6",
    "photo-studio",
    "setup",
    "Photo Studio",
    "Airbnb photos",
    "Cover pick + min-5 photo grid mock.",
    "Visual experts",
    1,
    "Airbnb photos",
    "Airbnb create-experience",
    "react",
    "Gallery",
    "Publish gate"
  ),
  labMeta(
    "s7",
    "stripe-connect",
    "setup",
    "Stripe Connect",
    "Whop payouts",
    "Connect Stripe mock + status chips.",
    "Paid sessions",
    2,
    "Whop payouts",
    "Whop Web Setting Affiliate",
    "static",
    "Payments",
    "Publish gate"
  ),
  labMeta(
    "s8",
    "guided-tour",
    "setup",
    "Guided Tour",
    "Podia tutorial",
    "Spotlight tour across 4 setup surfaces.",
    "First-time experts",
    4,
    "Podia tour",
    "Podia Web Completing tutorial",
    "static",
    "Spotlight",
    "Publish gate"
  ),
  labMeta(
    "s9",
    "publish-checklist",
    "setup",
    "Publish Checklist",
    "PoC E express hub",
    "Compact checklist + progress ring.",
    "Express finishers",
    6,
    "Express hub",
    "PoC E archived",
    "react",
    "Checklist",
    "Publish gate"
  ),
  labMeta(
    "s10",
    "commission-desk",
    "setup",
    "Commission Desk",
    "Whop affiliate",
    "Payout % slider, intro offers, sticky save.",
    "Pricing-focused",
    1,
    "Whop commission",
    "Whop Web Setting Affiliate",
    "static",
    "Commission",
    "Publish gate"
  ),
]

/** @deprecated Use EXPERT_ONBOARDING_LABS + EXPERT_SETUP_LABS */
export const EXPERT_ONBOARDING_LAB_WALKTHROUGHS = [
  ...EXPERT_ONBOARDING_LABS,
  ...EXPERT_SETUP_LABS,
]

export const EXPERT_ONBOARDING_WALKTHROUGHS: PocWalkthrough[] = [
  {
    id: "a",
    slug: "poc-a",
    title: "Chapter Sidebar",
    subtitle: "Airbnb-inspired chapters",
    tagline: "Dark sidebar, ~46 micro-steps.",
    bestFor: "Structured experts",
    stepCount: 46,
    mentalModel: "Airbnb host flow",
    stepsBeforeCompliance: "39 steps",
    href: `${BASE}/poc-a`,
    specPath: `${SPEC}/walkthroughs/poc-a-chapter-sidebar/readme.md`,
    status: "archived",
  },
  {
    id: "b",
    slug: "poc-b",
    title: "Live Preview",
    subtitle: "WYSIWYG builder",
    tagline: "Split member preview.",
    bestFor: "Brand-conscious",
    stepCount: 47,
    mentalModel: "WYSIWYG",
    stepsBeforeCompliance: "39 steps",
    href: `${BASE}/poc-b`,
    specPath: `${SPEC}/walkthroughs/poc-b-live-preview/readme.md`,
    status: "archived",
  },
  {
    id: "c",
    slug: "poc-c",
    title: "Event First",
    subtitle: "Service-first",
    tagline: "Session first → checklist.",
    bestFor: "Busy clinicians",
    stepCount: 18,
    mentalModel: "Event-first",
    stepsBeforeCompliance: "12 steps",
    href: `${BASE}/poc-c`,
    specPath: `${SPEC}/walkthroughs/poc-c-event-first/readme.md`,
    status: "archived",
  },
  {
    id: "d",
    slug: "poc-d",
    title: "Guided Prompts",
    subtitle: "Single-question flow",
    tagline: "Progress dots.",
    bestFor: "Mobile-first",
    stepCount: 13,
    mentalModel: "Typeform",
    stepsBeforeCompliance: "10 prompts",
    href: `${BASE}/poc-d`,
    specPath: `${SPEC}/walkthroughs/poc-d-guided-prompts/readme.md`,
    status: "archived",
  },
  {
    id: "e",
    slug: "poc-e",
    title: "Express or Complete",
    subtitle: "Choose depth",
    tagline: "Fork express vs complete.",
    bestFor: "Mixed audiences",
    stepCount: "4 or 46",
    mentalModel: "Fork",
    stepsBeforeCompliance: "Varies",
    href: `${BASE}/poc-e`,
    specPath: `${SPEC}/walkthroughs/poc-e-express-complete/readme.md`,
    status: "archived",
  },
]

export const POC_DOMAINS: PocDomain[] = [
  {
    id: "expert-onboarding",
    slug: "expert-onboarding",
    title: "Expert onboarding",
    description:
      "20 workspace-focused prototypes — 10 onboarding + 10 setting up. All start at Create workspace modal (same as PoC A–E).",
    status: "live",
    href: BASE,
    specPath: `${SPEC}/readme.md`,
    walkthroughs: EXPERT_ONBOARDING_WALKTHROUGHS,
    onboardingLabs: EXPERT_ONBOARDING_LABS,
    setupLabs: EXPERT_SETUP_LABS,
  },
  {
    id: "expert-profile",
    slug: "expert-profile",
    title: "Expert public profile",
    description: "Member-facing expert profile surfaces.",
    status: "planned",
    href: "/expert-profile",
    specPath: "_context/PoCs/expert-profile/readme.md",
    walkthroughs: [],
  },
  {
    id: "booking-flow",
    slug: "booking-flow",
    title: "Booking flow",
    description: "Session discovery and checkout.",
    status: "planned",
    href: "/booking-flow",
    specPath: "_context/PoCs/booking-flow/readme.md",
    walkthroughs: [],
  },
]

export function getPocDomain(slug: string): PocDomain | undefined {
  return POC_DOMAINS.find((d) => d.slug === slug)
}

export function getLabWalkthrough(slug: string): LabWalkthrough | undefined {
  return [...EXPERT_ONBOARDING_LABS, ...EXPERT_SETUP_LABS].find(
    (w) => w.slug === slug
  )
}

/** Old lab slug → new path */
export const LAB_REDIRECTS: Record<string, string> = {
  "setup-rail": `${BASE}/onboarding/setup-rail`,
  "focus-sweep": `${BASE}/onboarding/focus-sweep/index.html`,
  "pitch-split": `${BASE}/onboarding/pitch-split`,
  "intent-first": `${BASE}/onboarding/intent-categories/index.html`,
  "studio-canvas": `${BASE}/onboarding/studio-canvas`,
  "trust-clinic": `${BASE}/setup/security-mfa/index.html`,
  "dashboard-quest": `${BASE}/setup/dashboard-quest`,
  "settings-forge": `${BASE}/setup/settings-forge/index.html`,
  "path-fork": `${BASE}/onboarding/path-fork`,
  "monetize-pick": `${BASE}/onboarding/monetize-pick`,
}
