# Design audit

Open [`index.html`](index.html) in a browser. It is the plan: what is weak on
each surface, the Mobbin references that set the bar, and the roadmap of
slices. Nothing in the roadmap is built yet.

## Files

| Path                                                | What it is                                                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `index.html`                                        | The plan. Generated; do not edit by hand.                                                                      |
| `plan.json`                                         | Top moves and the roadmap (phases, slices, which findings each slice closes). Edit this.                       |
| `build.mjs`                                         | Builds `index.html` and each library readme. No dependencies.                                                  |
| `captures/{label}/{surface}/`                       | Screenshots (`.jpg`) and walkthrough videos (`.webm`), desktop and phone. `2026-11-14-before` is the baseline. |
| `_context/mobbin/library/{surface}/references.json` | Findings, Mobbin references and judging criteria per surface. Edit this.                                       |

## The loop for a design slice

1. Search Mobbin for the slice's problems and add what teaches something to
   the surface's `references.json` (image in `img/`).
2. Build the slice against the findings it closes.
3. Capture it again with a new label, with the dev servers running (web 3000,
   app 3001, api 3002, expert 3003, account 3006):

   ```bash
   E2E_DESIGN_CAPTURE=1 E2E_SKIP_WEBSERVER=1 E2E_ALLOW_DB_WRITES=1 \
     DESIGN_CAPTURE_LABEL=2026-11-20-d1.2 \
     pnpm exec playwright test e2e/design-capture.spec.ts --project=chromium --workers=1
   ```

   Add `-g "paid booking"` (or another test name) to capture one flow.

4. `node docs/eleva-v3/design-audit/build.mjs`. Where a later label has the
   same file as the baseline, the page shows before and after side by side.
5. Three judges score the after captures out of 10 against the surface's
   judging criteria, with the references open: UI and visual design; UX and
   UX writing; trust, legal, compliance and accessibility. Pass: every judge
   scores 8.5 or more and every P1 in the slice is closed. Otherwise revise
   and judge again. Record the scores in `../decision-log.md`.

## Notes on the captures

- Loopback only, dev database. The capture creates a throwaway account, an
  expert workspace and a free booking each run.
- Stills are taken with reduced motion, because sections fade in on scroll
  and a full-page screenshot never scrolls. Videos keep motion on.
- English, light theme. The seed has no expert photos and the demo member has
  no bookings.
