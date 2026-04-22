# Agent Skills & Cursor Rules Reference

**For:** All developers working with AI-assisted development  
**Status:** Active  
**Last Updated:** February 2026

---

## Overview

The Eleva Care project uses **32 agent skills** (in `.agents/skills/` and `.claude/skills/`) and **13 cursor rules** (in `.cursor/rules/`) to guide AI-assisted development. This document maps every skill and rule to the codebase, explains when each is triggered, and identifies areas where guidance can improve the implementation.

Skills are installed via the Skills CLI (`bunx skills add <owner/repo@skill>`) and tracked in `skills-lock.json`.

---

## Installed Skills Inventory

### Tier 1: Core Integration Skills

These skills directly match the app's primary technology integrations.

| Skill | Source | Trigger Phrases | App Files |
| ----- | ------ | --------------- | --------- |
| `workos-authkit-nextjs` | workos/skills | "install AuthKit", "auth setup", "login flow" | `src/proxy.ts`, `app/layout.tsx`, `app/api/auth/` |
| `workos` | workos/skills | "WorkOS", "SSO", "RBAC", "Vault", "MFA", "migrate from Clerk" | `src/lib/integrations/workos/`, `src/lib/auth/` |
| `stripe-integration` | wshobson/agents | "Stripe payments", "checkout", "subscriptions", "webhooks" | `src/lib/integrations/stripe/`, `app/api/webhooks/stripe*/` |
| `stripe-best-practices` | anthropics/claude-plugins-official | "payment best practices", "Checkout Sessions vs Payment Intents" | `src/server/actions/stripe*.ts`, `config/stripe.ts` |
| `neon-drizzle` | neondatabase/ai-rules | "Drizzle setup", "schema changes", "migrations" | `drizzle/schema.ts`, `drizzle/db.ts`, `drizzle.config.ts` |
| `neon-postgres` | neondatabase/agent-skills | "Neon", "branching", "connection pooling", "read replicas" | `src/lib/integrations/neon/` |
| `email-best-practices` | novuhq/novu | "email deliverability", "SPF/DKIM", "GDPR email", "bounce handling" | `src/emails/`, `src/lib/integrations/novu/` |
| `react-email` | resend/react-email | "email template", "React Email component", "email styling" | `src/emails/**/*.tsx` |
| `redis-js` | upstash/redis-js | "Redis", "caching", "rate limiting", "KV store" | `src/lib/redis/`, `src/lib/cache/` |

### Tier 2: Quality, Performance & Audit Skills

These skills provide guidelines for code quality, performance, accessibility, and SEO.

| Skill | Source | Trigger Phrases | App Files |
| ----- | ------ | --------------- | --------- |
| `vercel-react-best-practices` | vercel-labs/agent-skills | "React performance", "bundle size", "waterfalls", "re-renders" | All `src/` React code |
| `performance` | addyosmani/web-quality-skills | "Core Web Vitals", "LCP", "CLS", "page speed" | Entire `src/` codebase |
| `accessibility` | addyosmani/web-quality-skills | "a11y audit", "WCAG", "screen reader", "keyboard navigation" | `src/components/**/*.tsx` |
| `seo` | addyosmani/web-quality-skills | "SEO audit", "meta tags", "structured data", "crawlability" | `src/app/(marketing)/`, `src/lib/seo/` |
| `frontend-design` | anthropics/skills | "build UI", "landing page", "design component", "styling" | `src/components/`, `src/app/(marketing)/` |
| `web-design-guidelines` | vercel-labs/agent-skills | "review my UI", "audit design", "check UX" | `src/components/**/*.tsx` |
| `shadcn-ui` | jezweb/claude-skills | "Shadcn component", "UI primitive", "component library" | `src/components/ui/`, `components.json` |
| `tailwind-theme-builder` | jezweb/claude-skills | "Tailwind theme", "CSS variables", "design tokens" | `src/app/globals.css` |

### Tier 3: Monitoring & Security Skills

| Skill | Source | Trigger Phrases | App Files |
| ----- | ------ | --------------- | --------- |
| `sentry-fix-issues` | getsentry/sentry-agent-skills | "fix Sentry issue", "production error", "stacktrace" | `sentry.*.config.ts`, `instrumentation-client.ts` |
| `sentry-setup-logging` | getsentry/sentry-agent-skills | "Sentry logging", "structured logs", "logger.fmt" | `src/instrumentation.ts` |
| `security-review` | getsentry/skills | "security audit", "vulnerability check", "code security" | All `src/` code |
| `posthog-instrumentation` | posthog/posthog-for-claude | "PostHog event", "analytics tracking", "feature flag" | `src/app/providers.tsx` |

### Tier 4: Testing & Tooling Skills

| Skill | Source | Trigger Phrases | App Files |
| ----- | ------ | --------------- | --------- |
| `playwright-e2e-testing` | bobmatnyc/claude-mpm-skills | "E2E test", "Playwright test", "integration test" | `tests/`, `playwright.config.ts` |
| `agent-browser` | vercel-labs/agent-browser | "open website", "fill form", "take screenshot", "test web app" | N/A (tooling) |
| `find-skills` | vercel-labs/skills | "find a skill", "is there a skill for" | N/A (meta) |

### Tier 5: Technical Skills (NEW)

| Skill | Source | Trigger Phrases | App Files |
| ----- | ------ | --------------- | --------- |
| `next-intl-app-router` | liuchiawei/agent-skills | "i18n", "next-intl", "translations", "locale routing", "[locale]" | `src/lib/i18n/`, `src/messages/`, `src/proxy.ts` |
| `upstash-qstash` | sickn33/antigravity-awesome-skills | "QStash", "cron job", "scheduled task", "background job" | `src/lib/integrations/qstash/`, `src/app/api/cron/` |
| `tiptap` | jezweb/claude-skills | "rich text", "tiptap", "editor", "WYSIWYG", "markdown editor" | `src/components/shared/rich-text/` |

### Tier 6: Healthcare Compliance Skills (NEW)

These fill the critical gap of ZERO compliance-specific guidance for a platform that stores health records.

| Skill | Source | Trigger Phrases | App Files |
| ----- | ------ | --------------- | --------- |
| `security-compliance` | davila7/claude-code-templates | "SOC 2", "security audit", "compliance evidence", "security controls" | All compliance-related code |
| `gdpr-dsgvo-expert` | davila7/claude-code-templates | "GDPR", "data subject rights", "consent", "DPA", "data deletion" | `src/lib/integrations/workos/vault.ts`, `drizzle/schema.ts` |
| `healthcare-compliance` | eddiebe147/claude-settings | "HIPAA", "healthcare compliance", "PHI", "medical records security" | `src/app/api/records/`, health data routes |
| `hipaa-compliance-guard` | jorgealves/agent_skills | "HIPAA compliance", "PHI handling", "minimum necessary", "BAA" | Health data queries, audit logging |
| `data-retention-archiving-planner` | patricio0312rev/skills | "data retention", "right to erasure", "archiving", "data lifecycle" | `drizzle/schema.ts`, data deletion flows |

---

## Detailed Skill-to-Codebase Mapping

### Authentication: WorkOS

**Skills:** `workos-authkit-nextjs`, `workos`

**What the skills provide:**
- AuthKit Next.js integration (proxy.ts, callback route, AuthKitProvider)
- Composable `authkit()` function for existing proxy logic
- 12+ reference files: SSO, RBAC, Vault, Events, MFA, Directory Sync, Audit Logs, Admin Portal
- Migration guides (Clerk, Auth0, Supabase, Firebase, etc.)
- API reference for every WorkOS endpoint

**How the app uses it:**
- `src/proxy.ts` -- Uses `authkit()` composable with custom JWT-based RBAC checks
- `src/app/layout.tsx` -- Wraps app in `AuthKitProvider`
- `src/app/api/auth/callback/route.ts` -- OAuth callback via `handleAuth()`
- `src/lib/integrations/workos/client.ts` -- WorkOS SDK instance
- `src/lib/integrations/workos/rbac.ts` -- RBAC helpers using WorkOS roles
- `src/lib/integrations/workos/sync.ts` -- User sync between WorkOS and DB
- `src/lib/integrations/workos/vault.ts` -- WorkOS Vault for encrypted health data
- `src/lib/auth/roles.ts`, `roles.server.ts` -- Role constants and server-side checks
- `src/app/api/webhooks/workos/route.ts` -- WorkOS webhook processing
- `drizzle/schema.ts` -- `organizations`, `users`, `roles`, `user_org_memberships` tables

---

### Payments: Stripe

**Skills:** `stripe-integration`, `stripe-best-practices`

**How the app uses it:**
- `src/lib/integrations/stripe/client.ts` -- Stripe SDK client
- `src/lib/integrations/stripe/identity.ts` -- Stripe Identity for KYC
- `src/lib/integrations/stripe/transfer-utils.ts` -- Connect transfer logic
- `src/server/actions/stripe.ts` -- Server actions for Stripe operations
- `app/api/webhooks/stripe/route.ts` -- Main webhook (with handlers in `handlers/`)
- `app/api/webhooks/stripe-connect/route.ts` -- Connect account events
- `config/stripe.ts` -- Stripe configuration

---

### Database: Neon + Drizzle

**Skills:** `neon-drizzle`, `neon-postgres`

**How the app uses it:**
- `drizzle/schema.ts` -- 20+ tables with RLS enforcement
- `drizzle/db.ts` -- Neon serverless connection setup
- `src/lib/integrations/neon/rls-client.ts` -- Org-scoped DB for health data isolation

---

### Email & Notifications: Novu + React Email

**Skills:** `email-best-practices`, `react-email`

**How the app uses it:**
- `src/emails/` -- 14 React Email templates organized by category
- `src/config/novu.ts` -- Novu workflow definitions (`@novu/framework`)
- `src/lib/integrations/novu/client.ts` -- Novu API client (`@novu/api`)
- `src/components/integrations/novu/` -- Novu Inbox component (`@novu/react`)
- `src/app/api/novu/subscriber-hash/route.ts` -- HMAC subscriber hash endpoint (bridge endpoint not yet created)

---

### Internationalization: next-intl

**Skill:** `next-intl-app-router` (NEW)

**How the app uses it:**
- `src/lib/i18n/navigation.ts` -- `createNavigation(routing)` for locale-aware links
- `src/lib/i18n/request.ts` -- `getRequestConfig()` with locale fallback
- `src/lib/i18n/routing.ts` -- Locale configuration with `localePrefix: 'as-needed'`
- `src/messages/*.json` -- Translation files (ICU syntax)
- `src/proxy.ts` -- next-intl middleware integration

---

### Cron Jobs: Upstash QStash

**Skill:** `upstash-qstash` (NEW)

**How the app uses it:**
- `src/lib/integrations/qstash/client.ts` -- QStash client with no-op fallback
- `src/lib/integrations/qstash/signature-validator.ts` -- HMAC-SHA256 signature validation with key rotation
- `src/lib/integrations/qstash/schedules.ts` -- Schedule management
- `src/app/api/cron/` -- Cron job endpoints

---

### Rich Text: TipTap

**Skill:** `tiptap` (NEW)

**How the app uses it:**
- `src/components/shared/rich-text/RichTextEditor.tsx` -- TipTap editor with Markdown support
- Uses `immediatelyRender: false` for SSR safety (Next.js requirement)

---

### Healthcare Compliance

**Skills:** `security-compliance`, `gdpr-dsgvo-expert`, `healthcare-compliance`, `hipaa-compliance-guard`, `data-retention-archiving-planner` (ALL NEW)

**Existing compliance infrastructure:**
- `drizzle/schema.ts` -- Row-Level Security (RLS) declarations
- `src/lib/integrations/neon/rls-client.ts` -- Org-scoped database access (`getOrgScopedDb()`)
- `src/lib/integrations/workos/vault.ts` -- WorkOS Vault encryption (DEK/KEK envelope)
- `src/lib/utils/server/audit.ts` -- Audit event logging (`logAuditEvent()`)
- `src/lib/constants/security.ts` -- Security error detection
- `audit.config.ts` -- Audit log configuration
- Immutable `AuditLogsTable` with RLS protection

**Key regulations:**
- **GDPR** (EU/Portugal): Data subject rights (Arts 15-22), explicit consent for health data, 72h breach notification to CNPD
- **HIPAA** (US expansion): PHI handling, minimum necessary principle, 6-year retention, BAA requirements
- **SOC 2**: Security, availability, confidentiality, processing integrity controls

---

### Monitoring: Sentry

**Skills:** `sentry-fix-issues`, `sentry-setup-logging`

**How the app uses it:**
- `instrumentation-client.ts` -- Client SDK with Session Replay, User Feedback
- `sentry.server.config.ts` -- Server SDK
- `sentry.edge.config.ts` -- Edge runtime SDK
- `src/instrumentation.ts` -- Next.js instrumentation hook
- Tunnel route at `/monitoring` to bypass ad-blockers
- Sentry MCP tools available for debugging (org: `elevacade`, project: `eleva-care`)

---

### Analytics: PostHog

**Skill:** `posthog-instrumentation`

**How the app uses it:**
- `src/app/providers.tsx` -- PostHog provider initialization
- Client-side analytics tracking across the app

---

### Caching: Upstash Redis

**Skill:** `redis-js`

**How the app uses it:**
- `src/lib/redis/` -- Redis manager with cleanup utilities
- `src/lib/cache/` -- Redis error boundary and cache patterns
- Two-layer caching: React `cache()` for per-request + Redis for cross-request

---

### UI & Design

**Skills:** `frontend-design`, `web-design-guidelines`, `shadcn-ui`, `tailwind-theme-builder`, `tiptap`

**How the app uses them:**
- `src/components/ui/` -- 40+ Shadcn UI primitives
- `src/app/globals.css` -- Tailwind v4 CSS-based theme with `@theme` block
- `components.json` -- Shadcn configuration (base color: zinc)
- `src/components/shared/rich-text/` -- TipTap editor

---

### Security

**Skill:** `security-review`

**Relevance:** As a digital health platform handling sensitive patient data, security reviews are critical. This skill should be used before major releases.

---

### Performance & Quality Audits

**Skills:** `vercel-react-best-practices`, `performance`, `accessibility`, `seo`

**Priority rules from `vercel-react-best-practices` for this app:**

| Category | Rule | Relevance |
| -------- | ---- | --------- |
| Waterfalls (CRITICAL) | `async-parallel` | Use `Promise.all()` for independent DB queries |
| Bundle Size (CRITICAL) | `bundle-barrel-imports` | Audit `src/components/ui/` barrel exports |
| Bundle Size (CRITICAL) | `bundle-dynamic-imports` | Use `next/dynamic` for TipTap, heavy charts |
| Bundle Size (CRITICAL) | `bundle-defer-third-party` | Defer PostHog, Novu inbox after hydration |
| Server (HIGH) | `server-cache-react` | Use `React.cache()` for per-request dedup |
| Server (HIGH) | `server-after-nonblocking` | Use `after()` for audit logging, email sending |

---

### Testing

**Skills:** `playwright-e2e-testing`, `agent-browser`

**How the app uses them:**
- `playwright.config.ts` -- Playwright configuration
- `tests/` -- Test directory
- `vitest` -- Unit/integration tests (covered by `testing.mdc` cursor rule)

---

## Cursor Rules Summary

These are always-active or glob-matched rules in `.cursor/rules/`.

### Existing Rules (Enhanced)

| Rule | Applied | Scope | Key Enhancements |
| ---- | ------- | ----- | ---------------- |
| `nextjs-core.mdc` | Always | All `src/` TypeScript | +i18n section (next-intl patterns), +WorkOS proxy example, +Related Agent Skills |
| `sentry.mdc` | Always | All `src/` TypeScript | +Sentry MCP tools section, +Related Agent Skills |
| `ui-components.mdc` | Glob: `src/components/**`, `src/app/**` | TSX files | +WCAG 2.1 AA patterns, +Tailwind v4 note, +TipTap reference, +Related Agent Skills |
| `testing.mdc` | Glob: `tests/**`, `**/*.test.*` | Test files | Fixed `pnpm` → `bun run`, +Related Agent Skills |
| `database-security.mdc` | Glob: `drizzle/**`, `src/lib/auth/**`, `src/lib/stripe/**`, `src/server/**`, `src/lib/redis/**` | DB/Auth/Payments | Fixed broken globs, replaced Clerk → WorkOS, +RLS patterns, +Vault encryption, +audit logging, +Related Agent Skills |
| `fumadocs.mdc` | Glob: `src/content/**` | MDX/MD files | +Related Agent Skills (seo) |
| `ers-content-compliance.mdc` | Glob: `src/content/**`, `src/messages/**`, `src/components/**`, `src/emails/**` | Content files | +Related Agent Skills (email-best-practices, react-email) |
| `bun-runtime.mdc` | Manual | Config files | Unchanged |

### New Rules

| Rule | Applied | Scope | Content |
| ---- | ------- | ----- | ------- |
| `api-webhooks.mdc` | Glob: `src/app/api/**/*.ts` | 75 API route files | Webhook signature verification (Stripe, QStash, Novu), cron security, rate limiting, QStash no-op fallback |
| `email-templates.mdc` | Glob: `src/emails/**/*.tsx` | 14 email templates | React Email patterns, brand constants, inline styles, i18n locale passing, `render()` function |
| `server-actions.mdc` | Glob: `src/server/**/*.ts` | 19 server action files | `withAuth()` verification, Zod validation, cache invalidation patterns, RLS data access, error handling |
| `novu-notifications.mdc` | Glob: Novu files | 55+ notification files | Workflow definitions, trigger patterns, Inbox HMAC, bridge endpoint, React Email rendering, Stripe bridging, i18n locale passing, Zod v4 workaround |
| `health-compliance.mdc` | Description-only | Cross-cutting | GDPR (data subject rights, consent, DPIA, breach), HIPAA (PHI, BAAs, retention), SOC 2 controls, existing RLS/Vault/audit infrastructure patterns |

---

## Cross-Reference Matrix

Which skills and rules apply to each part of the codebase:

| Codebase Area | Skills | Rules |
| ------------- | ------ | ----- |
| **`src/proxy.ts`** | workos-authkit-nextjs, next-intl-app-router | nextjs-core |
| **`src/app/layout.tsx`** | workos-authkit-nextjs | nextjs-core, sentry |
| **`src/app/(app)/`** (dashboard) | vercel-react-best-practices, accessibility | nextjs-core, sentry, ui-components |
| **`src/app/(auth)/`** (login) | workos-authkit-nextjs, workos | nextjs-core, sentry |
| **`src/app/(marketing)/`** (public) | frontend-design, seo, performance, accessibility | nextjs-core, sentry, ers-content-compliance |
| **`src/app/api/webhooks/stripe*/`** | stripe-integration, stripe-best-practices | api-webhooks, sentry |
| **`src/app/api/webhooks/workos/`** | workos | api-webhooks, sentry |
| **`src/app/api/webhooks/novu/`** | email-best-practices | api-webhooks, novu-notifications, sentry |
| **`src/app/api/cron/`** | upstash-qstash, redis-js | api-webhooks, sentry |
| **`src/app/api/novu/`** | email-best-practices | novu-notifications, sentry |
| **`src/app/api/records/`** | hipaa-compliance-guard, gdpr-dsgvo-expert | api-webhooks, health-compliance |
| **`src/components/ui/`** | shadcn-ui, tailwind-theme-builder | ui-components |
| **`src/components/features/booking/`** | accessibility, vercel-react-best-practices | ui-components, sentry |
| **`src/components/integrations/novu/`** | email-best-practices | novu-notifications, ui-components |
| **`src/components/shared/rich-text/`** | tiptap | ui-components |
| **`src/emails/`** | react-email, email-best-practices | email-templates, ers-content-compliance |
| **`src/config/novu*.ts`** | email-best-practices | novu-notifications |
| **`src/lib/integrations/stripe/`** | stripe-integration, stripe-best-practices | database-security |
| **`src/lib/integrations/workos/`** | workos | database-security |
| **`src/lib/integrations/novu/`** | email-best-practices | novu-notifications, sentry |
| **`src/lib/integrations/qstash/`** | upstash-qstash | api-webhooks |
| **`src/lib/integrations/neon/`** | neon-postgres | database-security, health-compliance |
| **`src/lib/i18n/`** | next-intl-app-router | nextjs-core |
| **`src/lib/redis/`** | redis-js | database-security |
| **`src/server/actions/`** | stripe-integration, vercel-react-best-practices | server-actions, database-security, sentry |
| **`src/messages/`** (i18n) | next-intl-app-router | ers-content-compliance |
| **`src/content/`** (MDX) | seo | fumadocs, ers-content-compliance |
| **`drizzle/`** | neon-drizzle, neon-postgres, hipaa-compliance-guard | database-security, health-compliance |
| **`tests/`** | playwright-e2e-testing | testing |
| **`sentry.*.config.ts`** | sentry-fix-issues, sentry-setup-logging | sentry |

---

## Actionable Recommendations

### High Priority

1. **Stripe: Checkout Sessions vs Payment Intents** -- Evaluate if Checkout Sessions would reduce integration complexity.
2. **Bundle Size: Barrel Imports** -- Audit `src/components/ui/index.ts` barrel exports. Import directly from component files.
3. **Bundle Size: Defer Third-Party Scripts** -- Load PostHog and Novu Inbox after hydration with `next/dynamic({ ssr: false })`.
4. **Accessibility Audit** -- Run against patient-facing booking flow. WCAG 2.1 AA is expected for a health platform.
5. **GDPR Compliance** -- Implement data subject rights endpoints (access, erasure, portability).
6. **HIPAA Readiness** -- Document BAA requirements for all third-party services handling PHI.

### Medium Priority

7. **Server-Side Caching** -- Implement `React.cache()` for per-request dedup of DB calls.
8. **Non-Blocking Operations** -- Use `after()` API for audit logging, email sending.
9. **Email Deliverability** -- Verify SPF/DKIM/DMARC on sending domain.
10. **Data Retention Policies** -- Implement automated 6-year retention for HIPAA-covered records.

---

## MCP Server Inventory

Active MCP servers configured in `~/.cursor/mcp.json`:

| MCP Server | Type | Purpose |
| ---------- | ---- | ------- |
| `context7` | URL (HTTP) | Up-to-date library documentation and code examples |
| `Stripe` | CLI (`npx`) | Stripe API operations (products, prices, subscriptions) |
| `Linear` | URL (SSE) | Issue tracking and project management |
| `novu` | URL (EU) | Notification workflow management |
| `vercel` | URL | Deployment, domains, environment variables |
| `shadcn` | CLI (`npx`) | Component registry browsing and installation |
| `Neon` | URL (MCP) | Database management, branching, connection pooling |
| `Playwright` | CLI (`npx`) | Browser automation and E2E testing |
| `Figma Desktop` | Local | Design file inspection and code generation |
| `PostHog` | CLI (`npx`) | Analytics, feature flags, error tracking (NEW) |
| `Upstash` | CLI (`npx`) | Redis management, database queries, performance metrics (NEW) |
| `Sentry` | URL (MCP) | Error monitoring, issue analysis, trace inspection |

**Removed:** Sanity (unused), Commerce Layer Core/Metrics/Provisioning/Rules Engine (unused -- 4 servers)

---

## Recent Changes (February 2026)

### Cache Migration: `revalidatePath` to `updateTag`

All 5 server action files have been migrated from path-based to tag-based cache invalidation:

| File | Old Pattern | New Tags |
| ---- | ----------- | -------- |
| `expert-profile.ts` | 5x `revalidatePath` | `experts`, `expert-{userId}` |
| `expert-setup.ts` | `revalidatePath('/setup', '/dashboard')` | `expert-setup`, `expert-setup-{userId}` |
| `events.ts` | 4x `revalidatePath` | `events`, `event-{id}`, `user-events-{userId}` |
| `blocked-dates.ts` | 3x `revalidatePath('/booking/schedule')` | `schedules`, `user-schedule-{userId}` |
| `stripe-pricing.ts` | 4x `revalidatePath('/admin/subscriptions')` | `subscriptions`, `pricing` |

### next-intl 4.8 Precompilation

- Migrated `t.raw()` in `Services.tsx` and `ApproachSection.tsx` to indexed message keys
- Restructured `services.items` and `approach.items` from arrays to indexed objects in all 4 locale files
- Enabled `experimental.messages.precompile: true` in `next.config.ts`

### Rule Fixes

- `database-security.mdc`: Fixed `getOrgScopedDb(orgId)` to `getOrgScopedDb()` (no args)
- `api-webhooks.mdc`: Documented all 3 actual QStash patterns (`verifySignatureAppRouter`, `isVerifiedQStashRequest`, `CRON_SECRET` Bearer)
- `novu-notifications.mdc`: Removed non-existent bridge endpoint, fixed `securityWorkflow` to `securityAuthWorkflow`
- `fumadocs.mdc`: Added YAML frontmatter with globs
- `nextjs-core.mdc`: Replaced `'use cache'` examples with `unstable_cache` + tags, extended globs
- `server-actions.mdc`: Tag-based invalidation as primary pattern with naming convention

---

## How to Use Skills

### Triggering a Skill

Skills are automatically activated when the AI detects relevant trigger phrases. You can also explicitly request them:

```
"Use the stripe-best-practices skill to review my checkout flow"
"Run the accessibility skill against src/components/features/booking/"
"Apply the health-compliance rule to audit this data access pattern"
```

### Finding New Skills

```bash
bunx skills find "topic keyword"
bunx skills add owner/repo@skill-name
```

Browse available skills at [skills.sh](https://skills.sh/).

---

## Full Skill List (Quick Reference)

| # | Skill Name | Vendor/Source | Category |
| - | ---------- | ------------- | -------- |
| 1 | `workos-authkit-nextjs` | WorkOS (official) | Auth |
| 2 | `workos` | WorkOS (official) | Auth |
| 3 | `stripe-integration` | wshobson/agents | Payments |
| 4 | `stripe-best-practices` | Anthropic (official) | Payments |
| 5 | `neon-drizzle` | Neon (official) | Database |
| 6 | `neon-postgres` | Neon (official) | Database |
| 7 | `email-best-practices` | Novu (official) | Email |
| 8 | `react-email` | Resend (official) | Email |
| 9 | `redis-js` | Upstash (official) | Caching |
| 10 | `vercel-react-best-practices` | Vercel (official) | Performance |
| 11 | `performance` | Addy Osmani | Performance |
| 12 | `accessibility` | Addy Osmani | Accessibility |
| 13 | `seo` | Addy Osmani | SEO |
| 14 | `frontend-design` | Anthropic (official) | Design |
| 15 | `web-design-guidelines` | Vercel (official) | Design |
| 16 | `shadcn-ui` | jezweb/claude-skills | UI |
| 17 | `tailwind-theme-builder` | jezweb/claude-skills | UI |
| 18 | `sentry-fix-issues` | Sentry (official) | Monitoring |
| 19 | `sentry-setup-logging` | Sentry (official) | Monitoring |
| 20 | `security-review` | Sentry (official) | Security |
| 21 | `posthog-instrumentation` | PostHog (official) | Analytics |
| 22 | `playwright-e2e-testing` | bobmatnyc/claude-mpm-skills | Testing |
| 23 | `agent-browser` | Vercel (official) | Tooling |
| 24 | `find-skills` | Vercel (official) | Tooling |
| 25 | `next-intl-app-router` | liuchiawei/agent-skills | i18n (NEW) |
| 26 | `upstash-qstash` | sickn33/antigravity-awesome-skills | Cron/Jobs (NEW) |
| 27 | `tiptap` | jezweb/claude-skills | Rich Text (NEW) |
| 28 | `security-compliance` | davila7/claude-code-templates | Compliance (NEW) |
| 29 | `gdpr-dsgvo-expert` | davila7/claude-code-templates | Compliance (NEW) |
| 30 | `healthcare-compliance` | eddiebe147/claude-settings | Compliance (NEW) |
| 31 | `hipaa-compliance-guard` | jorgealves/agent_skills | Compliance (NEW) |
| 32 | `data-retention-archiving-planner` | patricio0312rev/skills | Compliance (NEW) |
