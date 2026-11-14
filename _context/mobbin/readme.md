# Mobbin reference library

Design references from [Mobbin](https://mobbin.com): how shipped products solve the problems Eleva has. Every design challenge, UX problem or UI improvement starts with a search here, and review panels score new designs against what is saved. Mobbin shows patterns, not templates: the Eleva logo, palette, type and voice stay.

Two parts:

- **`library/`** (2026-11-14 onward): references found through the Mobbin MCP, organised by product surface, each with the finding it answers.
- **`Apps/`**: earlier manual exports of whole onboarding and setting-up flows, used by the Expert Workspace Lab (below).

## `library/`: references by surface

| Surface                                                          | Covers                                                 | Findings | References |
| ---------------------------------------------------------------- | ------------------------------------------------------ | -------- | ---------- |
| [`01-homepage`](library/01-homepage/readme.md)                   | Public homepage                                        | 11       | 11         |
| [`02-discovery`](library/02-discovery/readme.md)                 | Expert explorer `/experts`                             | 9        | 12         |
| [`03-profile`](library/03-profile/readme.md)                     | Expert public profile                                  | 10       | 12         |
| [`04-booking-checkout`](library/04-booking-checkout/readme.md)   | Booking funnel, pay step, thank-you                    | 18       | 12         |
| [`05-auth`](library/05-auth/readme.md)                           | Sign in and sign up                                    | 10       | 11         |
| [`06-expert-onboarding`](library/06-expert-onboarding/readme.md) | New account to working practice                        | 15       | 12         |
| [`07-expert-dashboard`](library/07-expert-dashboard/readme.md)   | Expert practice app                                    | 16       | 12         |
| [`08-marketing`](library/08-marketing/readme.md)                 | Become an expert, for clinics, about                   | 12       | 11         |
| [`09-trust`](library/09-trust/readme.md)                         | Trust, legal and governance moments across the product | 16       | 12         |
| [`10-member-space`](library/10-member-space/readme.md)           | Member Space                                           | 10       | 12         |

Each surface folder holds:

- `references.json`: the source. The audit findings for that surface, the Mobbin references (app, pattern, why it works, what Eleva takes, the `mobbin_url`), and five to seven judging criteria.
- `img/`: the reference screens, named `NN-app-pattern.jpg`. A flow keeps several screens as `NNa-`, `NNb-`.
- `readme.md`: generated from the JSON by `node docs/eleva-v3/design-audit/build.mjs`. Do not edit it by hand.

The plan that uses these, with before captures beside them: [`docs/eleva-v3/design-audit/index.html`](../../docs/eleva-v3/design-audit/index.html).

### Adding references

1. Search with the Mobbin MCP. One screen, flow or section per query, in a plain phrase that starts with its type and names the kind of app ("therapist profile page", "appointment booking checkout"). At most three extra constraints, no style words.
2. Look at every result before keeping it. Keep only what teaches one specific thing.
3. Download the high-resolution `image_url` into the surface's `img/` (JPEG, 1800px on the long side at most) and add an entry to `references.json` with the `mobbin_url` as returned. Image links expire; the `mobbin_url` does not.
4. Point the finding it answers at the new reference id, then run the build.
5. A new surface gets a new numbered folder with the same three parts.

Leave out any screen that mentions HIPAA or another US framework. A reference from outside health is fine when its structure is the lesson; say so in `why`.

Reference screens belong to their owners and are kept for internal design review only.

## `Apps/`: flow exports for the Expert Workspace Lab

Screenshot-only, no annotations. Maps to **Expert Workspace Lab v4** in `apps/poc` (20 prototypes: O1–O10 onboarding + S1–S10 setting up).

### Structure

```
_context/mobbin/Apps/web/
├── onboarding/     (9 apps, ~148 PNGs)
└── setting up/     (8 apps, ~74 PNGs)
```

Each folder = one flow. Screens are zero-indexed PNGs (`{App} … 0.png`, `1.png`, …).

**Universal lab entry:** every prototype starts at `CreateWorkspaceModalMock` (Expert → Continue), same as PoC A–E.

---

## Onboarding flows → O1–O10

| App           | Screens | Pattern tags                | Workspace Lab                                                                                         |
| ------------- | ------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Attio**     | 21      | Split-pane, editorial story | [O3 Pitch Split](../PoCs/expert-onboarding/walkthroughs/onboarding-pitch-split/readme.md)             |
| **Clay**      | 24      | Workspace canvas, brand     | [O5 Studio Canvas](../PoCs/expert-onboarding/walkthroughs/onboarding-studio-canvas/readme.md)         |
| **Hims**      | 9       | Category cards entry        | [O4 Intent Categories](../PoCs/expert-onboarding/walkthroughs/onboarding-intent-categories/readme.md) |
| **Time2book** | 10      | Client vs Business fork     | [O6 Path Fork](../PoCs/expert-onboarding/walkthroughs/onboarding-path-fork/readme.md)                 |
| **Remote**    | 25      | Sidebar step tracker        | [O1 Setup Rail](../PoCs/expert-onboarding/walkthroughs/onboarding-setup-rail/readme.md)               |
| **Fresha**    | 14      | One question per screen     | [O2 Focus Sweep](../PoCs/expert-onboarding/walkthroughs/onboarding-focus-sweep/readme.md)             |
| **Wise**      | —       | Tier / jar picker           | [O7 Monetize Pick](../PoCs/expert-onboarding/walkthroughs/onboarding-monetize-pick/readme.md)         |
| **PoC B**     | —       | WYSIWYG live preview        | [O8 Live Preview](../PoCs/expert-onboarding/walkthroughs/onboarding-live-preview/readme.md)           |
| **PoC C**     | —       | Session-first pipeline      | [O9 Event First](../PoCs/expert-onboarding/walkthroughs/onboarding-event-first/readme.md)             |
| **PoC D**     | —       | Guided prompts              | [O10 Guided Prompts](../PoCs/expert-onboarding/walkthroughs/onboarding-guided-prompts/readme.md)      |

---

## Setting-up flows → S1–S10

| App         | Screens | Pattern tags                   | Workspace Lab                                                                                                                                                                             |
| ----------- | ------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fresha**  | 14      | Segmented progress             | (onboarding O2)                                                                                                                                                                           |
| **Heidi**   | 11      | MFA from settings              | [S3 Security MFA](../PoCs/expert-onboarding/walkthroughs/setup-security-mfa/readme.md)                                                                                                    |
| **Podia**   | —       | Inline settings rows, tutorial | [S1 Settings Forge](../PoCs/expert-onboarding/walkthroughs/setup-settings-forge/readme.md), [S8 Guided Tour](../PoCs/expert-onboarding/walkthroughs/setup-guided-tour/readme.md)          |
| **Shopify** | —       | Dashboard setup overlay        | [S2 Dashboard Quest](../PoCs/expert-onboarding/walkthroughs/setup-dashboard-quest/readme.md)                                                                                              |
| **Remote**  | 25      | Dashboard todos                | [S4 Todo Board](../PoCs/expert-onboarding/walkthroughs/setup-todo-board/readme.md)                                                                                                        |
| **Whop**    | —       | Payouts, affiliate commission  | [S7 Stripe Connect](../PoCs/expert-onboarding/walkthroughs/setup-stripe-connect/readme.md), [S10 Commission Desk](../PoCs/expert-onboarding/walkthroughs/setup-commission-desk/readme.md) |
| **Airbnb**  | —       | Photo upload grid              | [S6 Photo Studio](../PoCs/expert-onboarding/walkthroughs/setup-photo-studio/readme.md)                                                                                                    |
| **PoC E**   | —       | Express publish checklist      | [S9 Publish Checklist](../PoCs/expert-onboarding/walkthroughs/setup-publish-checklist/readme.md)                                                                                          |
| **Eleva**   | —       | Country compliance             | [S5 Compliance Gate](../PoCs/expert-onboarding/walkthroughs/setup-compliance-gate/readme.md)                                                                                              |

---

## Out of scope for this gallery

Account signup, email verification, password, and OTP flows (e.g. Craft OTP, ElevenLabs verify, ClassDojo MFA onboarding) — reserved for a future `/signup` gallery.

Hub: [Expert onboarding PoC](../PoCs/expert-onboarding/readme.md)
