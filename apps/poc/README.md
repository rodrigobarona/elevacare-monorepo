# apps/poc — Product PoC gallery

Single Next.js app for all interactive product walkthroughs.

## Run

```bash
pnpm --filter @eleva/poc dev
```

Port **3099** · [http://localhost:3099](http://localhost:3099)

## Structure

```
src/
  app/                          # Routes per domain
    page.tsx                    # Global hub
    expert-onboarding/          # Live domain
    expert-profile/             # Planned
    booking-flow/               # Planned
  components/wizard/            # Reusable wizard chrome (domain-agnostic)
  components/map/               # CARTO Positron + OSM maps (Leaflet)
  domains/
    expert-onboarding/          # Domain code: lib, registries, wizard runner
  lib/
    poc-catalog.ts              # SSOT — register domains & walkthroughs
    wizard-types.ts             # Shared wizard step types
    map-basemaps.ts             # CARTO Positron / Voyager tile SSOT
    nominatim.ts                # OSM geocoding helper
```

## Maps

Location and country steps use **OpenStreetMap** via **CARTO Positron** tiles (`leaflet` + `react-leaflet`). Address search uses Nominatim. Required attribution is rendered on each map. No API keys needed for the PoC.

Alternate basemap: `CARTO_VOYAGER` in `map-basemaps.ts`.

## Add a new domain

1. Add entry to `src/lib/poc-catalog.ts`
2. Create `src/domains/<slug>/` with components and lib
3. Add `src/app/<slug>/page.tsx` (hub + walkthrough routes)
4. Document under `_context/PoCs/<slug>/`

Spec docs: `_context/PoCs/readme.md`
