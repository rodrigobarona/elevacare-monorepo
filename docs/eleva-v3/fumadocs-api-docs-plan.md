# Fumadocs API Documentation Plan

**Status**: Planned (Future)  
**Prerequisite**: Phase 10 (OpenAPI spec) -- DONE  
**Depends on**: `apps/docs` moving from placeholder to production

## Current State

- `apps/docs` is a minimal Next.js placeholder with `basePath: '/docs'`
- No Fumadocs, no MDX, no content tree, no OpenAPI integration
- Dependencies: only `next`, `react`, `@eleva/ui`, `@eleva/observability`
- Single placeholder page: "Public docs placeholder. Portugal compliance content lands in Sprint 8."
- OpenAPI spec is now available at `GET /openapi.json` from `apps/api`

## Implementation Plan

When ready to build the public docs site:

### 1. Install Fumadocs

```bash
pnpm --filter @eleva/docs add fumadocs-core fumadocs-ui fumadocs-mdx fumadocs-openapi
```

### 2. Configure Source

Create `source.config.ts` with:

- MDX loader for hand-written guides
- OpenAPI loader pointing at `apps/api`'s `openapi.json` output

### 3. Site Structure

```
/docs                    -- Landing + getting started guides (MDX)
/docs/api-reference      -- Auto-generated from OpenAPI spec
/docs/guides             -- Hand-written integration guides
  /docs/guides/agents    -- AI agent integration guide
  /docs/guides/sdk       -- @eleva/api-client usage
/docs/changelog          -- API changelog / versioning
```

### 4. OpenAPI Integration

`fumadocs-openapi` auto-generates API reference pages from the spec:

- Request/response schemas with types
- Auth requirements per endpoint
- Code examples (curl, JavaScript, Python)
- Try-it panels for interactive testing

### 5. Feedback Mechanism

Fumadocs supports feedback widgets per page. Integrate with Linear for developer feedback on docs quality.

### 6. Search

Options:

- Fumadocs built-in search (good starting point)
- Algolia DocSearch (when traffic warrants it)

## References

- OpenAPI spec: `apps/api/src/lib/openapi.ts` + `GET /openapi.json`
- ADR: `docs/eleva-v3/api-first-architecture.md`
- Fumadocs docs: https://fumadocs.vercel.app/
- `fumadocs-openapi`: https://fumadocs.vercel.app/docs/openapi
