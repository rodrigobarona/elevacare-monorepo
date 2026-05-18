# API-First & Agentic-First Development

Build secure, agent-consumable API endpoints in the Eleva monorepo. Use when creating new API routes, refactoring Server Actions to use the API, wiring dual auth, or implementing BotID protection.

## When to Use

- Adding a new route handler in `apps/api`
- Refactoring a Server Action from direct DB access to domain functions or API calls
- Setting up authentication (session + Bearer dual auth)
- Adding rate limiting, BotID, or Zod validation to a route
- Creating or updating `@eleva/api-client` schemas

## Step 1: Define Zod Schemas

Schemas live in `packages/api-client/src/index.ts` and are shared between client and server:

```typescript
// packages/api-client/src/index.ts
export const MyRequestSchema = z.object({
  name: z.string().min(2).max(100).trim(),
})
export const MyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})
export type MyRequest = z.infer<typeof MyRequestSchema>
export type MyResponse = z.infer<typeof MyResponseSchema>
```

## Step 2: Create the Route Handler

All route handlers go in `apps/api/src/app/<resource>/route.ts`:

```typescript
import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { checkBot } from "@/lib/bot-protection"
import { UnauthorizedError } from "@eleva/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BodySchema = z.object({ name: z.string().min(2).max(100) })

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  // 1. Auth
  let session
  try {
    session = await requireApiAuth(request)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return secureJson({ error: "unauthorized" }, { status: 401, headers })
    }
    throw err
  }

  // 2. BotID (only for public-facing POST routes)
  const botBlocked = await checkBot({ checkLevel: "deepAnalysis" })
  if (botBlocked) return botBlocked

  // 3. Rate limit
  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  // 4. Validate
  const body = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  // 5. Domain logic (call @eleva/auth, @eleva/db helpers)
  // ... const result = await domainFunction(body.data) ...

  // 6. Response
  return secureJson({ ok: true }, { status: 201, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
```

## Step 3: Add Client Method

```typescript
// packages/api-client/src/index.ts
// Inside createApiClient():
myResource: {
  create(data: MyRequest) {
    return request<MyResponse>("POST", "/my-resource", data)
  },
},
```

## Step 4: Refactor Server Action

Replace inline DB logic with domain function calls:

```typescript
// Before (BAD -- inline DB):
const d = db()
const [row] = await d.insert(main.users).values({...}).returning(...)

// After (GOOD -- domain function):
import { provisionUser } from "@eleva/auth"
const { userId } = await provisionUser({ workosUserId: user.id, completedOnboarding: true })
```

## Dual Auth Pattern

`resolveApiAuth()` in `apps/api/src/lib/auth.ts` handles:

1. **Bearer token** in `Authorization: Bearer <token>` -- for AI agents, CLI, M2M
2. **Session cookie** -- for browser apps using WorkOS AuthKit
3. **Anonymous** -- returned when no credentials present

Use `requireApiAuth()` to reject anonymous callers with 401.

## Rate Limit Tiers

| Category                | Config                               | Key             |
| ----------------------- | ------------------------------------ | --------------- |
| Authenticated mutations | `RATE_LIMITS.authenticated` (60/min) | `user:<userId>` |
| Public endpoints        | `RATE_LIMITS.public` (10/min)        | `ip:<address>`  |
| Onboarding              | `RATE_LIMITS.onboarding` (5/min)     | `ip:<address>`  |

## BotID

- Only on public-facing POST routes (onboarding, signup, contact forms)
- Skip for Bearer-authenticated routes (agents use API keys, not browsers)
- Skip for internal routes (cron, QStash, workflow drainer)
- Uses `checkBot()` from `apps/api/src/lib/bot-protection.ts`
- Opt-in: gracefully passes through when `botid` package is not installed

## Security Checklist

For every new route, verify:

- [ ] Auth: `requireApiAuth()` or `requireApiCapability()` called
- [ ] Rate limiting: `applyRateLimit()` with appropriate tier
- [ ] Validation: Zod schema for request body, 422 on failure
- [ ] CORS: `corsHeaders()` from `@/lib/cors` on all responses + OPTIONS handler
- [ ] Security headers: `secureJson()` from `@/lib/security-headers`
- [ ] BotID: `checkBot()` if public-facing POST
- [ ] Error format: `{ error: string, issues?, message? }` with correct HTTP status
- [ ] OpenAPI: schema registered in `apps/api/src/lib/openapi.ts`

## Key Files

- `apps/api/src/lib/auth.ts` -- dual auth resolver
- `apps/api/src/lib/rate-limit.ts` -- rate limiting with `@upstash/ratelimit`
- `apps/api/src/lib/security-headers.ts` -- HSTS, X-Content-Type-Options, etc.
- `apps/api/src/lib/bot-protection.ts` -- Vercel BotID wrapper
- `apps/api/src/lib/cors.ts` -- strict CORS matcher
- `packages/api-client/src/index.ts` -- typed client + shared Zod schemas
- `packages/auth/src/provisioning.ts` -- user/org/membership provisioning
- `.cursor/rules/api-first-agentic.mdc` -- the accompanying Cursor rule
