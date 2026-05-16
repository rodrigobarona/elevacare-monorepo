## Learned User Preferences

- All HTTP API endpoints (`route.ts`) must live in `apps/api`. Never create API routes in `apps/web` or `apps/app`. Server Actions (`"use server"`) are fine in any app.

## Learned Workspace Facts

- `docs/eleva-v3/` is the workspace area for Eleva v3 architecture, specs, and ADR-style planning docs.
- `_context/clone-repo/` stores monorepo-tracked reference snapshots such as `eleva-care-app`, `cal.diy`, and `next-forge`, with nested `.git` directories removed so they are kept as plain files.
- `@eleva/storage` owns ALL `@vercel/blob` access. Boundary lint forbids direct `@vercel/blob` imports outside this package. Entrypoints: `blob-upload-handler` (server), `blob-upload-client` (client).
- Two Vercel Blob stores: **public** (`BLOB_READ_WRITE_TOKEN`) for avatars and marketing assets, **private** (`BLOB_PRIVATE_READ_WRITE_TOKEN`) for expert documents, patient reports, and PHI. Never store patient/health data in the public store. See `.cursor/rules/blob-storage.mdc` for details.
- Shared dependency versions are managed via **pnpm Catalog** in `pnpm-workspace.yaml`. When adding or bumping a cataloged dependency, edit the `catalog:` section in `pnpm-workspace.yaml` and use `"catalog:"` as the version in `package.json`. Never hardcode semver ranges for cataloged packages. See `.cursor/rules/pnpm-catalog.mdc` for the full protocol.
