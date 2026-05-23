# Wizard framework (POC v2)

Shared step engine in `apps/poc/src/components/wizard/`. Domain-specific runners live under `apps/poc/src/domains/<domain>/components/wizard/`.

## Components

| Component | Role |
|-----------|------|
| `WizardRunner` | Orchestrates registry, draft state, modal entry, navigation (domain-specific) |
| `WizardShell` | Header (Save & exit), optional sidebar, footer slot |
| `WizardFooter` | Back · progress bar · Next (disabled until valid) |
| `StepFrame` | One H1, one helper, single input area, optional illustration |
| `PhaseInterstitial` | Chapter intro — no data collected |
| `StepRenderer` | Maps `StepKind` → UI (domain-specific) |
| `AiSuggestDrawer` | Secondary AI — drawer only, never dominant chrome |
| `MemberProfilePreview` | POC B right pane |
| `PostSubmitHub` | Post-publish checklist (Airbnb listing-property pattern) |
| `DashboardHandoff` | POC C/E express incomplete checklist |

## Maps (location / country)

Shared map stack in `apps/poc/src/components/map/` — **OpenStreetMap data** via **CARTO Positron** raster tiles (default). Voyager available in `map-basemaps.ts` for future discovery PoCs.

| Component | Role |
|-----------|------|
| `CartoMap` | Base Leaflet map + tile layer + OSM/CARTO attribution |
| `CountryPreviewMap` | Read-only mini map per PT/ES/BR (`country-grid` step) |
| `AddressSearchMap` | Nominatim geocode + preview pin (`address-search` step) |
| `LocationPinMap` | Drag map, fixed center pin (`map-confirm` step) |

Geocoding: [Nominatim](https://nominatim.openstreetmap.org/) with country filter and debounce. No API keys required for PoC tiles or geocoding (respect OSM usage policy in production).

## Registries

Declarative step lists in `apps/poc/src/domains/expert-onboarding/lib/registries/`:

- `poc-a-steps.ts` — ~46 micro-steps (reference)
- `poc-c-steps.ts` — event-first ~18 steps
- `poc-d-steps.ts` — guided prompts ~13 steps
- `poc-e-express-steps.ts` — express ~5 steps

Each step:

```typescript
{
  id: string           // matches docs 1:1
  kind: StepKind
  title: string        // single goal / question
  helper?: string
  canProceed: (draft) => boolean
  chapterId?: string   // sidebar module
  stepInChapter?: number
  optional?: boolean   // shows Skip
}
```

## Adding a new domain

1. Copy the pattern: `domains/<slug>/lib/registries/` + `components/wizard/wizard-runner.tsx`
2. Reuse `@/components/wizard/*` for chrome
3. Register walkthroughs in `apps/poc/src/lib/poc-catalog.ts`
4. Document steps under `_context/PoCs/<slug>/walkthroughs/`

[← PoC hub](../readme.md)
