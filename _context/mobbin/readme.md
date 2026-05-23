# Mobbin reference library

Visual flow references exported from [Mobbin](https://mobbin.com). Screenshot-only — no annotations yet. Maps to **Expert Workspace Lab v4** in `apps/poc` (20 prototypes: O1–O10 onboarding + S1–S10 setting up).

## Structure

```
_context/mobbin/Apps/web/
├── onboarding/     (9 apps, ~148 PNGs)
└── setting up/     (8 apps, ~74 PNGs)
```

Each folder = one flow. Screens are zero-indexed PNGs (`{App} … 0.png`, `1.png`, …).

**Universal lab entry:** every prototype starts at `CreateWorkspaceModalMock` (Expert → Continue), same as PoC A–E.

---

## Onboarding flows → O1–O10

| App | Screens | Pattern tags | Workspace Lab |
|-----|---------|--------------|---------------|
| **Attio** | 21 | Split-pane, editorial story | [O3 Pitch Split](../PoCs/expert-onboarding/walkthroughs/onboarding-pitch-split/readme.md) |
| **Clay** | 24 | Workspace canvas, brand | [O5 Studio Canvas](../PoCs/expert-onboarding/walkthroughs/onboarding-studio-canvas/readme.md) |
| **Hims** | 9 | Category cards entry | [O4 Intent Categories](../PoCs/expert-onboarding/walkthroughs/onboarding-intent-categories/readme.md) |
| **Time2book** | 10 | Client vs Business fork | [O6 Path Fork](../PoCs/expert-onboarding/walkthroughs/onboarding-path-fork/readme.md) |
| **Remote** | 25 | Sidebar step tracker | [O1 Setup Rail](../PoCs/expert-onboarding/walkthroughs/onboarding-setup-rail/readme.md) |
| **Fresha** | 14 | One question per screen | [O2 Focus Sweep](../PoCs/expert-onboarding/walkthroughs/onboarding-focus-sweep/readme.md) |
| **Wise** | — | Tier / jar picker | [O7 Monetize Pick](../PoCs/expert-onboarding/walkthroughs/onboarding-monetize-pick/readme.md) |
| **PoC B** | — | WYSIWYG live preview | [O8 Live Preview](../PoCs/expert-onboarding/walkthroughs/onboarding-live-preview/readme.md) |
| **PoC C** | — | Session-first pipeline | [O9 Event First](../PoCs/expert-onboarding/walkthroughs/onboarding-event-first/readme.md) |
| **PoC D** | — | Guided prompts | [O10 Guided Prompts](../PoCs/expert-onboarding/walkthroughs/onboarding-guided-prompts/readme.md) |

---

## Setting-up flows → S1–S10

| App | Screens | Pattern tags | Workspace Lab |
|-----|---------|--------------|---------------|
| **Fresha** | 14 | Segmented progress | (onboarding O2) |
| **Heidi** | 11 | MFA from settings | [S3 Security MFA](../PoCs/expert-onboarding/walkthroughs/setup-security-mfa/readme.md) |
| **Podia** | — | Inline settings rows, tutorial | [S1 Settings Forge](../PoCs/expert-onboarding/walkthroughs/setup-settings-forge/readme.md), [S8 Guided Tour](../PoCs/expert-onboarding/walkthroughs/setup-guided-tour/readme.md) |
| **Shopify** | — | Dashboard setup overlay | [S2 Dashboard Quest](../PoCs/expert-onboarding/walkthroughs/setup-dashboard-quest/readme.md) |
| **Remote** | 25 | Dashboard todos | [S4 Todo Board](../PoCs/expert-onboarding/walkthroughs/setup-todo-board/readme.md) |
| **Whop** | — | Payouts, affiliate commission | [S7 Stripe Connect](../PoCs/expert-onboarding/walkthroughs/setup-stripe-connect/readme.md), [S10 Commission Desk](../PoCs/expert-onboarding/walkthroughs/setup-commission-desk/readme.md) |
| **Airbnb** | — | Photo upload grid | [S6 Photo Studio](../PoCs/expert-onboarding/walkthroughs/setup-photo-studio/readme.md) |
| **PoC E** | — | Express publish checklist | [S9 Publish Checklist](../PoCs/expert-onboarding/walkthroughs/setup-publish-checklist/readme.md) |
| **Eleva** | — | Country compliance | [S5 Compliance Gate](../PoCs/expert-onboarding/walkthroughs/setup-compliance-gate/readme.md) |

---

## Out of scope for this gallery

Account signup, email verification, password, and OTP flows (e.g. Craft OTP, ElevenLabs verify, ClassDojo MFA onboarding) — reserved for a future `/signup` gallery.

Hub: [Expert onboarding PoC](../PoCs/expert-onboarding/readme.md)
