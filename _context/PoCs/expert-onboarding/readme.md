# Expert onboarding — Workspace Lab (v4)

Interactive prototypes for client review. **Runnable app:** `apps/poc` on port **3099**.

```bash
pnpm --filter @eleva/poc dev
```

Open [http://localhost:3099/expert-onboarding](http://localhost:3099/expert-onboarding).

[← PoC hub](../readme.md)

---

## Universal entry

**All 20 labs** open with the same **`CreateWorkspaceModalMock`** used by classic PoC A–E:

1. Modal on first paint
2. User selects **Expert** → **Continue**
3. Lab content appears (no email, password, or OTP)

Static HTML labs use [`create-space-snippet.js`](../../../apps/poc/public/expert-onboarding/shared/create-space-snippet.js) to mirror the modal.

---

## Workspace onboarding (O1–O10)

Build draft Expert Space → **draft saved handoff** (no compliance/Stripe inline).

| ID | Route | Spec |
|----|-------|------|
| O1 Setup Rail | `/expert-onboarding/onboarding/setup-rail` | [onboarding-setup-rail](walkthroughs/onboarding-setup-rail/readme.md) |
| O2 Focus Sweep | `/expert-onboarding/onboarding/focus-sweep/index.html` | [onboarding-focus-sweep](walkthroughs/onboarding-focus-sweep/readme.md) |
| O3 Pitch Split | `/expert-onboarding/onboarding/pitch-split` | [onboarding-pitch-split](walkthroughs/onboarding-pitch-split/readme.md) |
| O4 Intent Categories | `/expert-onboarding/onboarding/intent-categories/index.html` | [onboarding-intent-categories](walkthroughs/onboarding-intent-categories/readme.md) |
| O5 Studio Canvas | `/expert-onboarding/onboarding/studio-canvas` | [onboarding-studio-canvas](walkthroughs/onboarding-studio-canvas/readme.md) |
| O6 Path Fork | `/expert-onboarding/onboarding/path-fork` | [onboarding-path-fork](walkthroughs/onboarding-path-fork/readme.md) |
| O7 Monetize Pick | `/expert-onboarding/onboarding/monetize-pick` | [onboarding-monetize-pick](walkthroughs/onboarding-monetize-pick/readme.md) |
| O8 Live Preview | `/expert-onboarding/onboarding/live-preview` | [onboarding-live-preview](walkthroughs/onboarding-live-preview/readme.md) |
| O9 Event First | `/expert-onboarding/onboarding/event-first` | [onboarding-event-first](walkthroughs/onboarding-event-first/readme.md) |
| O10 Guided Prompts | `/expert-onboarding/onboarding/guided-prompts` | [onboarding-guided-prompts](walkthroughs/onboarding-guided-prompts/readme.md) |

---

## Setting up your Space (S1–S10)

Same modal entry → **seed draft** → publish tasks on existing draft Space.

| ID | Route | Spec |
|----|-------|------|
| S1 Settings Forge | `/expert-onboarding/setup/settings-forge/index.html` | [setup-settings-forge](walkthroughs/setup-settings-forge/readme.md) |
| S2 Dashboard Quest | `/expert-onboarding/setup/dashboard-quest` | [setup-dashboard-quest](walkthroughs/setup-dashboard-quest/readme.md) |
| S3 Security MFA | `/expert-onboarding/setup/security-mfa/index.html` | [setup-security-mfa](walkthroughs/setup-security-mfa/readme.md) |
| S4 Todo Board | `/expert-onboarding/setup/todo-board` | [setup-todo-board](walkthroughs/setup-todo-board/readme.md) |
| S5 Compliance Gate | `/expert-onboarding/setup/compliance-gate` | [setup-compliance-gate](walkthroughs/setup-compliance-gate/readme.md) |
| S6 Photo Studio | `/expert-onboarding/setup/photo-studio` | [setup-photo-studio](walkthroughs/setup-photo-studio/readme.md) |
| S7 Stripe Connect | `/expert-onboarding/setup/stripe-connect/index.html` | [setup-stripe-connect](walkthroughs/setup-stripe-connect/readme.md) |
| S8 Guided Tour | `/expert-onboarding/setup/guided-tour/index.html` | [setup-guided-tour](walkthroughs/setup-guided-tour/readme.md) |
| S9 Publish Checklist | `/expert-onboarding/setup/publish-checklist` | [setup-publish-checklist](walkthroughs/setup-publish-checklist/readme.md) |
| S10 Commission Desk | `/expert-onboarding/setup/commission-desk/index.html` | [setup-commission-desk](walkthroughs/setup-commission-desk/readme.md) |

Old `/expert-onboarding/lab/*` URLs redirect to the new paths.

---

## Classic wizard explorations (archived)

Still runnable — same Create workspace modal entry.

| PoC | Route |
|-----|-------|
| A — Chapter Sidebar | `/expert-onboarding/poc-a` |
| B — Live Preview | `/expert-onboarding/poc-b` |
| C — Event First | `/expert-onboarding/poc-c` |
| D — Guided Prompts | `/expert-onboarding/poc-d` |
| E — Express or Complete | `/expert-onboarding/poc-e` |

---

## Shared specs

- [Data model](shared/data-model.md)
- [Country requirements](shared/country-requirements.md)
- [Mobbin index](../../mobbin/readme.md)
