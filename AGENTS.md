## Learned User Preferences

- All HTTP API endpoints (`route.ts`) must live in `apps/api`. Never create API routes in `apps/web` or `apps/app`. Server Actions (`"use server"`) are fine in any app.

## Learned Workspace Facts

- `docs/eleva-v3/` is the workspace area for Eleva v3 architecture, specs, and ADR-style planning docs.
- `_context/clone-repo/` stores monorepo-tracked reference snapshots such as `eleva-care-app`, `cal.diy`, and `next-forge`, with nested `.git` directories removed so they are kept as plain files.
- `@eleva/storage` owns ALL `@vercel/blob` access. Boundary lint forbids direct `@vercel/blob` imports outside this package. Entrypoints: `blob-upload-handler` (server), `blob-upload-client` (client).
