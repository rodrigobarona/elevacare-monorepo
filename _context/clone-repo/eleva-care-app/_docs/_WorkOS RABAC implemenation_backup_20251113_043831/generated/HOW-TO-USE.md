# How to Use the Generated RBAC Configuration Files

**Generated:** November 13, 2025  
**Purpose:** Guide for importing roles and permissions into WorkOS Dashboard

---

## 📁 Generated Files Overview

This folder contains multiple formats of the same RBAC configuration to suit different needs:

### 1. **workos-rbac-config.json**

- **Format:** JSON
- **Use For:** Programmatic access, API integration (if WorkOS adds API support in future)
- **Contains:** Complete configuration including metadata

### 2. **workos-permissions.csv**

- **Format:** CSV (Comma-Separated Values)
- **Use For:** Importing permissions into WorkOS Dashboard or Excel
- **Columns:** Slug, Name, Description, Category
- **Rows:** 137 permissions

### 3. **workos-roles.csv**

- **Format:** CSV
- **Use For:** Overview of roles, planning, documentation
- **Columns:** Slug, Name, Description, Priority, Inherits From, Total Permissions
- **Rows:** 6 roles

### 4. **workos-role-permission-matrix.csv**

- **Format:** CSV Matrix
- **Use For:** Visual verification, audit, documentation
- **Structure:** Rows = Roles, Columns = Permissions, "X" = has permission

### 5. **workos-rbac-config.md**

- **Format:** Markdown
- **Use For:** Documentation, GitHub wiki, code reviews
- **Contains:** Complete documentation with tables and copy-paste sections

### 6. **workos-rbac-constants.ts**

- **Format:** TypeScript
- **Use For:** Code integration, type-safe permission checks
- **Contains:** Constants, types, and role-permission mappings

---

## 🚀 Quick Start: Setting Up WorkOS Dashboard

### Step 1: Access WorkOS Dashboard

1. Go to [dashboard.workos.com](https://dashboard.workos.com)
2. Navigate to **RBAC** → **Roles & Permissions**

### Step 2: Import Permissions (CSV Method)

**Option A: Using the CSV File (Recommended for bulk import)**

1. Open `workos-permissions.csv` in Excel or Google Sheets
2. Review the permissions by category
3. **Manual Import (WorkOS doesn't support CSV upload yet):**
   - For each category, copy permissions in batches
   - In WorkOS Dashboard, click "Create Permission"
   - Paste each permission's details:
     - **Slug:** Exact slug from CSV (e.g., `appointments:view_own`)
     - **Name:** Display name from CSV
     - **Description:** Description from CSV

**Option B: Using the Markdown File (Easy copy-paste)**

1. Open `workos-rbac-config.md`
2. Go to the "Copy-Paste Format" section
3. Find "All Permissions" list
4. Copy permissions by category
5. Create each permission in WorkOS Dashboard

**⚠️ Important Notes:**

- Permission slugs are **immutable** - double-check spelling before creating
- Use the exact slug format: `resource:action` (e.g., `appointments:view_own`)
- Create ALL permissions before creating roles
- Recommended order: Create by category (makes it easier to track progress)

### Step 3: Create Roles

**Using the workos-roles.csv:**

1. Open `workos-roles.csv`
2. Create roles in **priority order** (lowest to highest):

```
Priority 10:  patient
Priority 60:  clinic_member (Phase 2)
Priority 70:  expert_community
Priority 80:  expert_top
Priority 90:  clinic_admin (Phase 2)
Priority 100: superadmin
```

**For Each Role:**

1. In WorkOS Dashboard, click "Create Role"
2. Fill in details from CSV:
   - **Name:** Display name (e.g., "Expert Community")
   - **Slug:** Role slug (e.g., `expert_community`)
   - **Description:** Description from CSV
   - **Priority:** Priority number from CSV
3. Assign permissions:
   - Open `workos-rbac-config.md`
   - Find the role's section under "Copy-Paste Format"
   - Copy the list of permission slugs
   - In WorkOS Dashboard, search and select each permission

**⚠️ Inheritance Note:**

- WorkOS doesn't have built-in inheritance
- Each role must have ALL permissions explicitly assigned
- Use the resolved permission lists in the markdown file (inheritance already calculated)

### Step 4: Verify Configuration

**Verification Checklist:**

- [ ] All 137 permissions created
- [ ] All 6 roles created (or 4 if skipping Phase 2)
- [ ] Each role has correct priority
- [ ] Permission counts match the CSV:
  - Patient: 16 permissions
  - Expert Community: 52 permissions
  - Expert Top: 60 permissions
  - Clinic Member: 56 permissions (Phase 2)
  - Clinic Admin: 77 permissions (Phase 2)
  - Platform Admin: 137 permissions

**Test Configuration:**

1. Create a test user
2. Assign them to a role
3. Check the JWT claims contain the correct permissions
4. Test permission checks in your application

---

## 💻 Code Integration

### Using the TypeScript Constants

**Import the generated constants:**

```typescript
import {
  ROLE_PERMISSIONS,
  WORKOS_PERMISSIONS,
  WORKOS_ROLES,
  type WorkOSPermission,
  type WorkOSRole,
} from '@/_docs/_WorkOS RABAC implemenation/generated/workos-rbac-constants';
```

**Check permissions in code:**

```typescript
// Using constants (type-safe)
const hasAnalytics = permissions.includes(WORKOS_PERMISSIONS.ANALYTICS_VIEW);

// Check if user has required permissions for a role
const requiredPermissions = ROLE_PERMISSIONS['expert_top'];
const hasAllPermissions = requiredPermissions.every((perm) => userPermissions.includes(perm));
```

**Type-safe permission checks:**

```typescript
function hasPermission(permission: WorkOSPermission): boolean {
  return userPermissions.includes(permission);
}

// TypeScript will error if you use an invalid permission
hasPermission('invalid:permission'); // ❌ TypeScript error
hasPermission(WORKOS_PERMISSIONS.APPOINTMENTS_VIEW_OWN); // ✅ Valid
```

**Middleware protection:**

```typescript
import { WORKOS_PERMISSIONS } from '@/_docs/_WorkOS RABAC implemenation/generated/workos-rbac-constants';

export function requirePermission(permission: WorkOSPermission) {
  return async (req: Request) => {
    const session = await getSession(req);

    if (!session.permissions.includes(permission)) {
      throw new Error('Forbidden');
    }

    // Continue...
  };
}

// Usage
app.get('/analytics', requirePermission(WORKOS_PERMISSIONS.ANALYTICS_VIEW), analyticsHandler);
```

---

## 📊 Understanding the Role-Permission Matrix

**Open `workos-role-permission-matrix.csv` to:**

1. **Audit Access:** See exactly what each role can do
2. **Find Gaps:** Identify missing permissions
3. **Plan Changes:** Visualize impact of adding/removing permissions
4. **Compliance:** Generate reports for security audits

**How to Read the Matrix:**

- **Rows:** Each permission
- **Columns:** Each role
- **"X":** Role has this permission
- **Empty:** Role doesn't have this permission

**Example Use Cases:**

```csv
Permission               | Patient | Expert Community | Expert Top
appointments:view_own    | X       | X                | X
analytics:view          |         |                  | X
```

This shows:

- All roles can view their own appointments
- Only Expert Top can view analytics

---

## 🔄 Keeping Configuration in Sync

### When to Regenerate Files

Run the sync script whenever you:

- Add new permissions
- Add new roles
- Change role inheritance
- Update permission descriptions

### How to Regenerate

```bash
# 1. Edit the configuration in:
scripts/utilities/workos-rbac-config.ts

# 2. Validate changes
pnpm tsx scripts/utilities/workos-rbac-config.ts validate

# 3. Regenerate all formats
pnpm tsx scripts/utilities/workos-rbac-config.ts generate-all
```

### Workflow

1. **Update Source Code:**
   - Edit `PERMISSIONS` or `ROLES` arrays in the script
   - Add/remove/modify permissions or roles

2. **Validate:**
   - Run validation to catch errors
   - Fix any configuration issues

3. **Generate:**
   - Generate all formats
   - Review changes in generated files

4. **Apply to WorkOS:**
   - Manually create new permissions/roles in Dashboard
   - Update role permissions if changed

5. **Deploy Code:**
   - Commit the script and generated files
   - Deploy updated TypeScript constants to production

---

## 🎯 Phase 1 vs Phase 2 Roles

### Phase 1: Implement Now (4 roles)

✅ **Patient** - Priority 10  
✅ **Expert Community** - Priority 70  
✅ **Expert Top** - Priority 80  
✅ **Platform Admin** - Priority 100

**Why:** These roles cover the current application features.

### Phase 2: Implement Later (2 roles)

🔮 **Clinic Member** - Priority 60  
🔮 **Clinic Admin** - Priority 90

**Why:** These roles are for future clinic features.

**For Phase 1 Only:**

- Create only the 4 Phase 1 roles
- Skip clinic-related permissions (saves time)
- Add them later when implementing clinic features

---

## 📝 Best Practices

### Permission Naming

✅ **Do:**

- Use consistent `resource:action` format
- Keep slugs concise (JWT size limits)
- Use clear, descriptive names
- Group by resource category

❌ **Don't:**

- Use spaces in slugs
- Create overly long slugs
- Mix naming conventions
- Create duplicate permissions

### Role Design

✅ **Do:**

- Follow principle of least privilege
- Use clear role names
- Document role purposes
- Set appropriate priorities

❌ **Don't:**

- Give users more permissions than needed
- Create overlapping roles
- Skip role descriptions
- Ignore priority order

### Maintenance

✅ **Do:**

- Keep script and Dashboard in sync
- Version control the configuration
- Document changes
- Test before deploying

❌ **Don't:**

- Edit Dashboard without updating script
- Skip validation
- Deploy untested changes
- Forget to regenerate files

---

## 🐛 Troubleshooting

### "Permission not found" errors

**Problem:** Code references permissions that don't exist in WorkOS

**Solution:**

1. Check if permission exists in WorkOS Dashboard
2. Verify slug spelling (case-sensitive)
3. Regenerate TypeScript constants
4. Clear application cache

### "Duplicate slug" errors

**Problem:** Trying to create permission/role with existing slug

**Solution:**

1. Permission/role already exists
2. Use different slug or update existing one
3. Check if it was created in different environment

### Role inheritance not working

**Problem:** Child role doesn't have parent permissions

**Solution:**

1. WorkOS doesn't have automatic inheritance
2. Use the resolved permission lists from generated files
3. Manually assign all permissions to each role

### JWT size too large

**Problem:** Too many permissions, JWT exceeds browser limits

**Solution:**

1. Reduce number of permissions per role
2. Use more generic permissions
3. Combine related permissions
4. Consider permission groups

---

## 📞 Support

### Documentation

- **Main Guide:** `../WORKOS-ROLES-PERMISSIONS-CONFIGURATION.md`
- **Quick Setup:** `../WORKOS-DASHBOARD-QUICK-SETUP.md`
- **Visual Reference:** `../WORKOS-RBAC-VISUAL-MATRIX.md`
- **WorkOS Docs:** https://workos.com/docs/rbac

### Need Help?

1. **Check validation:** Run `pnpm tsx scripts/utilities/workos-rbac-config.ts validate`
2. **Review config:** Run `pnpm tsx scripts/utilities/workos-rbac-config.ts summary`
3. **Contact team:** #dev-platform Slack channel

---

**Last Updated:** November 13, 2025  
**Configuration Version:** 1.0  
**Total Permissions:** 137  
**Total Roles:** 6
