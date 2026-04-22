---
name: WorkOS RBAC Status Review
overview: This plan reviews the current WorkOS implementation status, identifies what's complete vs. pending, and outlines the next steps to finish the Clerk to WorkOS migration with RBAC fully configured.
todos:
  - id: dashboard-permissions
    content: Complete creating all 89 permissions in WorkOS Dashboard
    status: pending
  - id: dashboard-roles
    content: Create 6 roles with correct priorities in WorkOS Dashboard
    status: pending
  - id: dashboard-assign
    content: Assign permissions to each role in WorkOS Dashboard
    status: pending
  - id: dashboard-default
    content: Set default role to 'patient' in WorkOS Dashboard
    status: pending
  - id: verify-jwt
    content: Verify JWT includes role and permissions claims after login
    status: pending
  - id: test-protected-routes
    content: Test permission-protected routes work correctly
    status: pending
  - id: migration-script
    content: Create and run migration script for existing users
    status: pending
    dependencies:
      - verify-jwt
---

# WorkOS Implementation Status Review and Next Steps

## Current Implementation Status

Based on analysis of the documentation and codebase, here is the complete status:

### Phase 1: Code Implementation - COMPLETE

| Component | Status | Files |

|-----------|--------|-------|

| TypeScript Types | Done | [`src/types/workos-rbac.ts`](src/types/workos-rbac.ts) - 6 roles, 89+ permissions |

| Server RBAC Utilities | Done | [`src/lib/integrations/workos/rbac.ts`](src/lib/integrations/workos/rbac.ts) - JWT-based, zero DB queries |

| Client RBAC Provider | Done | [`src/components/providers/RBACProvider.tsx`](src/components/providers/RBACProvider.tsx) |

| Proxy/Middleware | Done | [`src/proxy.ts`](src/proxy.ts) - Permission-protected routes |

| API Endpoint | Done | [`src/app/api/user/rbac/route.ts`](src/app/api/user/rbac/route.ts) |

| WorkOS Vault | Done | Encryption migration complete |

| RequireRole Component | Done | [`src/components/rbac/RequireRole.tsx`](src/components/rbac/RequireRole.tsx) |

### Phase 2: WorkOS Dashboard Configuration - IN PROGRESS (Your current task)

According to [`_docs/workos-setup-checklist.txt`](_docs/workos-setup-checklist.txt), you need to configure:

```mermaid
flowchart TD
    subgraph step1 [Step 1: Create Permissions]
        P1[89 Permissions in Dashboard]
        P2[Resource:Action format]
        P3["e.g., appointments:view_own"]
    end
    
    subgraph step2 [Step 2: Create Roles]
        R1[patient - Priority 10]
        R2[expert_community - Priority 70]
        R3[expert_top - Priority 80]
        R4[partner_member - Priority 60]
        R5[partner_admin - Priority 90]
        R6[superadmin - Priority 100]
    end
    
    subgraph step3 [Step 3: Assign Permissions]
        A1[Patient: 16 permissions]
        A2[Expert Community: 52 permissions]
        A3[Expert Top: 60 permissions]
        A4[Partner Member: 55 permissions]
        A5[Partner Admin: 76 permissions]
        A6[Superadmin: ALL 121 permissions]
    end
    
    subgraph step4 [Step 4: Set Default]
        D1[Default role: patient]
    end
    
    step1 --> step2 --> step3 --> step4
```

### Phase 3: Testing and Verification - NOT STARTED

### Phase 4: Role Migration - NOT STARTED

### Phase 5: Stripe Entitlements - FUTURE (Q1 2026)

---

## Next Steps

### Immediate (Complete Dashboard Setup)

1. **Continue creating permissions in WorkOS Dashboard**

   - Follow the exact slugs from [`_docs/workos-setup-checklist.txt`](_docs/workos-setup-checklist.txt)
   - Use `resource:action` format (e.g., `appointments:view_own`)

2. **Create the 6 roles with correct priorities**

   - patient (10), partner_member (60), expert_community (70), expert_top (80), partner_admin (90), superadmin (100)

3. **Set default role to `patient`**

### After Dashboard Setup

4. **Verify JWT includes role and permissions**
   ```typescript
   // Test with: GET /api/user/rbac
   // Should return: { role: 'patient', permissions: [...] }
   ```

5. **Test permission-protected routes**

   - `/admin/*` requires superadmin
   - `/dashboard/expert/*` requires expert roles
   - `/booking/*` requires expert roles

### Migration Script (When Ready)

6. **Run migration for existing users**

   - Script location: [`scripts/migrate-roles-to-workos.ts`](scripts/migrate-roles-to-workos.ts) (to be created)
   - Maps existing `users.role` to WorkOS organization membership roles

---

## Architecture Summary

```mermaid
flowchart LR
    subgraph Auth [Authentication]
        A1[User Login] --> A2[WorkOS AuthKit]
        A2 --> A3[JWT with Role + Permissions]
    end
    
    subgraph App [Application]
        A3 --> B1[Proxy/Middleware]
        B1 --> B2{Route Protected?}
        B2 -->|Yes| B3[Check JWT Permissions]
        B2 -->|No| B4[Allow]
        B3 -->|Pass| B4
        B3 -->|Fail| B5[Redirect /unauthorized]
    end
    
    subgraph Client [Client Components]
        A3 --> C1[RBACProvider]
        C1 --> C2[useRBAC Hook]
        C2 --> C3[Conditional Rendering]
    end
```

---

## Key Files Reference

| Purpose | File |

|---------|------|

| Role/Permission definitions | `src/types/workos-rbac.ts` |

| Server-side checks | `src/lib/integrations/workos/rbac.ts` |

| Client-side hooks | `src/components/providers/RBACProvider.tsx` |

| Route protection | `src/proxy.ts` |

| Dashboard setup guide | `_docs/workos-setup-checklist.txt` |

| Full RBAC documentation | `_docs/_WorkOS RABAC implemenation/` |

---

## Questions Before Proceeding

1. How far along are you in the WorkOS Dashboard configuration? (How many of the 89 permissions have been created?)
2. Have you verified JWT claims include `role` and `permissions` after login?
3. Do you have existing users in production that need role migration?