# Naming Conventions & Glossary

**Date:** January 14, 2026  
**Status:** ✅ Active  
**Owner:** Product & Engineering Teams

---

## Executive Summary

This document establishes consistent naming conventions across marketing, product, documentation, and technical layers for Eleva Care's multi-tenant B2B features.

**Key Principle:** Different audiences need different terminology, but internal systems must map consistently.

---

## Terminology Matrix

| Layer | Term | Slug/ID | Audience | Example |
|-------|------|---------|----------|---------|
| **Marketing** | Organization | `/for-organizations` | Public, B2B prospects | "For Organizations" landing page |
| **Product UI** | Workspace | `/workspace` | Users, admins | "Workspace Dashboard" |
| **Documentation** | Workspace | `/docs/workspace` | Users learning the product | "Workspace Portal" docs |
| **RBAC Roles** | Partner | `partner_member`, `partner_admin` | Technical, WorkOS | Role assignments |
| **Database** | Workspace | `workspace_*` tables | Internal, developers | `workspace_settings` |
| **Revenue Model** | Workspace | `workspace_commission_*` | Business logic | Commission calculations |

---

## Why Different Terms?

### Marketing: "Organization"
- **Audience:** B2B decision-makers, procurement teams
- **Reason:** Generic, professional, appeals to clinics, employers, institutions
- **Usage:** Landing pages, sales materials, external communications

### Product: "Workspace"
- **Audience:** Daily users (admins, team members)
- **Reason:** Modern SaaS term (Slack, Notion), implies collaboration
- **Usage:** Dashboard, settings, team management

### Technical: "Partner"
- **Audience:** Developers, WorkOS configuration
- **Reason:** Distinguishes from WorkOS "Organization" (which is our tenant container)
- **Usage:** RBAC roles, permissions, API endpoints

---

## Role Naming Convention

### WorkOS RBAC Roles

```typescript
// src/types/workos-rbac.ts
export const WORKOS_ROLES = {
  PATIENT: 'patient',           // Basic user
  PARTNER_MEMBER: 'partner_member',   // Workspace team member
  EXPERT_COMMUNITY: 'expert_community', // Standard expert
  EXPERT_TOP: 'expert_top',         // Premium expert
  PARTNER_ADMIN: 'partner_admin',    // Workspace administrator
  SUPERADMIN: 'superadmin',        // Platform admin
} as const;
```

### Role Priority (Hierarchy)

```typescript
// src/lib/auth/roles.server.ts
const ROLE_PRIORITY: WorkOSRole[] = [
  WORKOS_ROLES.PATIENT,        // Priority 10 - Lowest
  WORKOS_ROLES.PARTNER_MEMBER, // Priority 60
  WORKOS_ROLES.EXPERT_COMMUNITY, // Priority 70
  WORKOS_ROLES.EXPERT_TOP,     // Priority 80
  WORKOS_ROLES.PARTNER_ADMIN,  // Priority 90
  WORKOS_ROLES.SUPERADMIN,     // Priority 100 - Highest
];
```

### Display Names (User-Facing)

```typescript
// src/types/workos-rbac.ts
export const WORKOS_ROLE_DISPLAY_NAMES: Record<WorkOSRole, string> = {
  [WORKOS_ROLES.PATIENT]: 'Patient',
  [WORKOS_ROLES.EXPERT_COMMUNITY]: 'Community Expert',
  [WORKOS_ROLES.EXPERT_TOP]: 'Top Expert',
  [WORKOS_ROLES.PARTNER_MEMBER]: 'Workspace Member',  // User sees "Workspace"
  [WORKOS_ROLES.PARTNER_ADMIN]: 'Workspace Admin',    // User sees "Workspace"
  [WORKOS_ROLES.SUPERADMIN]: 'Platform Admin',
};
```

---

## URL Structure

### Marketing Routes
```
/for-organizations          → B2B landing page
/contact?partner=true       → Partnership inquiry
```

### Documentation Routes
```
/docs/workspace             → Workspace Portal documentation
/docs/workspace/team        → Team management docs
/docs/workspace/pricing     → Workspace pricing docs
```

### App Routes
```
/workspace                  → Workspace dashboard (future)
/workspace/team             → Team management
/workspace/settings         → Workspace settings
/workspace/analytics        → Workspace analytics
```

### API Routes
```
/api/workspace              → Workspace CRUD
/api/workspace/team         → Team management
/api/workspace/invitations  → Team invitations
```

---

## Database Naming

### Tables (Future Implementation)

```sql
-- Workspace settings (replaces clinic_settings)
workspace_settings
  - id
  - org_id (WorkOS organization)
  - workspace_name
  - workspace_commission_rate
  - workspace_branding_enabled
  - created_at
  - updated_at

-- Workspace invitations
workspace_invitations
  - id
  - workspace_id
  - email
  - role (partner_member | partner_admin)
  - status
  - invited_by
  - created_at
  - expires_at
```

### Commission Fields

```sql
-- Transaction commissions
transaction_commissions
  - workspace_commission_rate    -- NOT clinic_commission_rate
  - workspace_commission_amount  -- NOT clinic_commission_amount
  - organization_type: 'workspace' | 'expert_individual'
```

---

## Migration Notes

### From "Clinic" to "Workspace"

The revenue model documentation uses "Clinic" terminology. When implementing:

1. **Database:** Use `workspace_*` naming
2. **Code:** Use `workspace*` variables
3. **UI:** Display "Workspace"
4. **Docs:** Reference "Workspace"

### Mapping Table

| Old Term (Docs) | New Term (Implementation) |
|-----------------|---------------------------|
| `clinic` | `workspace` |
| `clinic_settings` | `workspace_settings` |
| `clinic_commission_rate` | `workspace_commission_rate` |
| `clinic_fee` | `workspace_fee` |
| `ClinicSettingsTable` | `WorkspaceSettingsTable` |

---

## Validation Checklist

### Marketing Alignment
- [ ] Landing page uses "For Organizations"
- [ ] CTAs use "Partner with Us" or "Create Workspace"
- [ ] Sales materials consistent

### Documentation Alignment
- [ ] Docs portal named "Workspace Portal"
- [ ] All docs reference "workspace" not "clinic"
- [ ] Getting started guides use "workspace"

### Technical Alignment
- [ ] RBAC roles use `partner_*` prefix
- [ ] Database tables use `workspace_*` prefix
- [ ] API endpoints use `/workspace/`
- [ ] Display names show "Workspace Member/Admin"

### Code Alignment
- [ ] `WORKOS_ROLE_DISPLAY_NAMES` shows "Workspace"
- [ ] UI components use "Workspace" terminology
- [ ] Error messages use "Workspace"

---

## Related Documentation

- `_docs/_WorkOS RABAC implemenation/WORKOS-ROLES-PERMISSIONS-CONFIGURATION.md` - Full RBAC config
- `_docs/02-core-systems/THREE-PARTY-CLINIC-REVENUE-MODEL.md` - Revenue model (uses "Clinic", migrate to "Workspace")
- `src/types/workos-rbac.ts` - Role definitions
- `src/lib/auth/roles.server.ts` - Role priority logic
- `src/content/docs/workspace/` - Workspace documentation

---

## Quick Reference

### When to Use Each Term

| Situation | Use |
|-----------|-----|
| Talking to prospects | "Organization" |
| In the product UI | "Workspace" |
| In documentation | "Workspace" |
| In code/RBAC | "Partner" (roles) |
| In database | "Workspace" (tables) |
| In API endpoints | "Workspace" |

### Role Slug → Display Name

| Slug | Display |
|------|---------|
| `partner_member` | Workspace Member |
| `partner_admin` | Workspace Admin |

---

**Last Updated:** January 14, 2026  
**Next Review:** Before Workspace feature launch

