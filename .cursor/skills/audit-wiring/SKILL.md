# Audit Wiring — `withAudit` from `@eleva/audit`

Wire transactional audit logging into mutating API routes and domain functions.
Use when adding new endpoints, refactoring existing mutations to include audit
trails, or extending the audit entity/action model.

## When to Use

- Adding a new mutating API route (POST/PUT/PATCH/DELETE) in `apps/api`
- Adding a new domain function that writes to the database
- Refactoring an existing mutation to include audit logging
- Extending `AuditEntity` or `AuditAction` with new values
- Debugging why audit events are not appearing in the audit DB
- Reviewing code for audit compliance

## Step-by-Step Workflow

### Step 1: Identify Entity and Action

Determine what is being mutated and what verb describes the operation:

| Operation                  | Entity                          | Action           |
| -------------------------- | ------------------------------- | ---------------- |
| Create an event type       | `event_type`                    | `created`        |
| Update expert profile      | `expert_profile`                | `updated`        |
| Delete a schedule override | `schedule`                      | `updated`        |
| Disconnect calendar        | `expert_integration_credential` | `disconnected`   |
| Publish an event type      | `event_type`                    | `status_changed` |

### Step 2: Check/Extend Type Unions

Open `packages/audit/src/types.ts` and verify the entity and action exist:

```typescript
export type AuditEntity =
  | "user"
  | "organization"
  | "membership"
  | "role"
  | "permission"
  | "expert_profile"
  | "expert_integration_credential"
// Add new entity here if needed

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "restored"
  | "role_changed"
  | "status_changed"
  | "invited"
  | "accepted"
  | "removed"
  | "submitted"
  | "approved"
  | "rejected"
  | "claimed"
  | "connected"
  | "disconnected"
// Add new action here if needed
```

If the value does not exist, add it to the union. TypeScript will then accept
it at all `ctx.emit()` call sites.

### Step 3: Determine Placement

**Domain package** (preferred when the function is called from multiple places):

```text
packages/auth/src/provisioning.ts   → withAudit wraps the provisioning logic
packages/billing/src/server/...     → withAudit wraps subscription changes
```

**API route handler** (when the route is the sole orchestrator):

```text
apps/api/src/app/experts/event-types/route.ts → withAudit in the POST handler
apps/api/src/app/users/avatar/route.ts        → withAudit in PUT/DELETE handlers
```

### Step 4: Implement

#### Pattern A — Domain Function

```typescript
import { withAudit } from "@eleva/audit"
import { main } from "@eleva/db"

export async function createEventType(input: {
  orgId: string
  actorUserId: string
  name: string
  duration: number
}) {
  const id = crypto.randomUUID()

  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [row] = await tx
        .insert(main.eventTypes)
        .values({
          id,
          orgId: input.orgId,
          name: input.name,
          duration: input.duration,
        })
        .returning()

      await ctx.emit({
        entity: "event_type",
        action: "created",
        entityId: id,
        payload: { name: input.name, duration: input.duration },
      })

      return row
    }
  )
}
```

#### Pattern B — API Route Handler

```typescript
import { withAudit } from "@eleva/audit"
import { main } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "DELETE, OPTIONS")
  const session = await requireApiAuth(request)
  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const { id } = await params

  await withAudit(
    { orgId: session.orgId, actorUserId: session.user.id },
    async (tx, ctx) => {
      await tx.delete(main.eventTypes).where(eq(main.eventTypes.id, id))

      await ctx.emit({
        entity: "event_type",
        action: "deleted",
        entityId: id,
        payload: {},
      })
    }
  )

  return secureJson({ ok: true }, { headers })
}
```

### Step 5: Verify

After implementing, check:

- [ ] Entity value exists in `AuditEntity` union
- [ ] Action value exists in `AuditAction` union
- [ ] `entityId` is set to the primary key of the mutated resource
- [ ] `payload` includes meaningful context (no PII: no passwords, tokens, full emails)
- [ ] All DB writes inside `fn` use the `tx` handle (not `db()`)
- [ ] `ctx.emit()` is called exactly once
- [ ] Error handling: `withAudit` itself throws on missing emit — ensure the route returns a proper error response if it catches
- [ ] For updates: consider including `{ before: {...}, after: {...} }` in payload

## Payload Anti-Patterns

```typescript
// BAD — full PII
await ctx.emit({
  entity: "user",
  action: "updated",
  entityId: userId,
  payload: { email: "user@example.com", passwordHash: "..." },
})

// GOOD — minimal identifying info + what changed
await ctx.emit({
  entity: "user",
  action: "updated",
  entityId: userId,
  payload: { field: "avatar_url", before: oldUrl, after: newUrl },
})
```

## Multiple Entities in One Route

If a single route creates multiple related entities (e.g., org + membership +
user sync), use **one `withAudit` for the primary entity** and include
secondary entity info in the payload:

```typescript
await withAudit({ orgId, actorUserId }, async (tx, ctx) => {
  await tx.insert(main.organizations).values({ id: orgId, ... })
  await tx.insert(main.memberships).values({ userId, orgId, role: "admin" })

  await ctx.emit({
    entity: "organization",
    action: "created",
    entityId: orgId,
    payload: { type: "personal", initialMember: { userId, role: "admin" } },
  })
})
```

## Exceptions (no audit needed)

- Read-only operations (GET endpoints, Server Component data fetching)
- Health/readiness probes
- The audit drainer itself
- Cookie-only changes (locale, last-active-org)
- Blob upload completion callbacks (the initiating action is audited)

## Key Files

| File                                                      | Purpose                              |
| --------------------------------------------------------- | ------------------------------------ |
| `packages/audit/src/with-audit.ts`                        | `withAudit` / `withPlatformAudit`    |
| `packages/audit/src/types.ts`                             | `AuditEntity` / `AuditAction` unions |
| `packages/audit/README.md`                                | Full documentation                   |
| `packages/db/src/schema/main/audit-outbox.ts`             | Outbox table schema                  |
| `packages/db/src/schema/audit/audit-events.ts`            | Audit events table                   |
| `packages/workflows/src/drainers/audit-outbox-drainer.ts` | Drainer                              |
| `packages/auth/src/provisioning.ts`                       | Reference implementation             |
| `.cursor/rules/audit-wiring.mdc`                          | Auto-triggered rule                  |
| `docs/eleva-v3/adrs/ADR-003-tenancy-and-rls.md`           | ADR                                  |
