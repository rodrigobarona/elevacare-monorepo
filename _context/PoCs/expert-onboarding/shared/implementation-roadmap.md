# Implementation roadmap (post-POC)

1. **Keep** org-switcher modal (`CreateWorkspaceModal`) — change Expert continue URL to new walkthrough route
2. **Replace** `/account/workspaces/create/expert` name-only step with selected POC pattern
3. **Extend** `EXPERT_WIZARD_STEPS` — reorder Connect/Identity/Invoicing to final gate
4. **Add** `@eleva/editor` with Plate.js + `@plate/ai-kit`
5. **Schema** — `localizedContent: { en, pt, es }` on profile + event types
6. **API** — `POST /ai/expert/onboarding`, OpenAPI registration, audit for mutations
7. **Self-service** — no admin pre-approval to create org; optional review on publish request
