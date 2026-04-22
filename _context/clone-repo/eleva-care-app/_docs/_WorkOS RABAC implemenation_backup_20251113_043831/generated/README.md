# Generated WorkOS RBAC Configuration Files

**Auto-generated from:** `scripts/utilities/workos-rbac-config.ts`  
**Last Generated:** November 13, 2025  
**Configuration Version:** 1.0

---

## 📊 Quick Stats

- **Total Permissions:** 132
- **Total Roles:** 6 (4 Phase 1, 2 Phase 2)
- **Permission Categories:** 25
- **Format Options:** 6 different formats

---

## 📁 Files in This Directory

### 📖 Documentation

- **[HOW-TO-USE.md](./HOW-TO-USE.md)** - Complete guide for using these files
- **[IMPORT-CHECKLIST.md](./IMPORT-CHECKLIST.md)** - Step-by-step import checklist with checkboxes
- **README.md** (this file) - Overview and quick links

### 📊 Data Files

- **workos-rbac-config.json** - Complete configuration in JSON format
- **workos-permissions.csv** - All permissions (importable to Excel)
- **workos-roles.csv** - All roles with metadata
- **workos-role-permission-matrix.csv** - Visual permission matrix
- **workos-rbac-config.md** - Full documentation with copy-paste sections

### 💻 Code Integration

- **workos-rbac-constants.ts** - TypeScript constants for code integration

---

## 🚀 Quick Start

### New to WorkOS RBAC?

1. **Read first:** [HOW-TO-USE.md](./HOW-TO-USE.md)
2. **Then follow:** [IMPORT-CHECKLIST.md](./IMPORT-CHECKLIST.md)
3. **Reference:** `workos-rbac-config.md` while importing

### Already Familiar?

1. Open [WorkOS Dashboard](https://dashboard.workos.com)
2. Go to **RBAC** → **Roles & Permissions**
3. Use `workos-permissions.csv` to create permissions
4. Use `workos-rbac-config.md` to create roles

### Integrating with Code?

1. Copy `workos-rbac-constants.ts` to your codebase
2. Import and use the constants:

```typescript
import { WORKOS_PERMISSIONS, WORKOS_ROLES } from './workos-rbac-constants';

// Type-safe permission checks
if (permissions.includes(WORKOS_PERMISSIONS.ANALYTICS_VIEW)) {
  // Show analytics
}
```

---

## 📋 Configuration Summary

### Phase 1 Roles (Implement Now)

| Role                 | Slug               | Priority | Permissions | Description                               |
| -------------------- | ------------------ | -------- | ----------- | ----------------------------------------- |
| **Patient**          | `patient`          | 10       | 16          | Basic user/patient role                   |
| **Expert Community** | `expert_community` | 70       | 52          | Standard expert tier (20%/12% commission) |
| **Expert Top**       | `expert_top`       | 80       | 60          | Premium expert tier (18%/8% commission)   |
| **Platform Admin**   | `superadmin`       | 100      | 132         | Full system access                        |

### Phase 2 Roles (Future - Clinic Features)

| Role                 | Slug            | Priority | Permissions | Description          |
| -------------------- | --------------- | -------- | ----------- | -------------------- |
| **Clinic Member** 🔮 | `clinic_member` | 60       | 56          | Clinic team member   |
| **Clinic Admin** 🔮  | `clinic_admin`  | 90       | 77          | Clinic administrator |

### Permission Categories

<details>
<summary>Core Features (57 permissions)</summary>

- Appointments (9)
- Sessions (2)
- Patients (6)
- Events (5)
- Availability (5)
- Calendars (4)
- Reviews (6)
- Profile (6)
- Experts (7)
- Dashboard (2)
- Settings (7)
- Billing (8)
</details>

<details>
<summary>Expert Features (13 permissions)</summary>

- Analytics (10)
- Branding (3)
</details>

<details>
<summary>Clinic Features (20 permissions) 🔮</summary>

- Clinic (7)
- Team (5)
- Schedule (3)
- Revenue (5)
</details>

<details>
<summary>Platform Admin (32 permissions)</summary>

- Users (6)
- Organizations (5)
- Payments (5)
- Categories (4)
- Moderation (4)
- Audit (4)
- Support (4)
</details>

---

## 🔄 Regenerating Files

**When to regenerate:**

- Added new permissions
- Added new roles
- Changed role inheritance
- Updated descriptions
- Fixed configuration errors

**How to regenerate:**

```bash
# From project root
cd /Users/rodrigo.barona/Documents/GitHub/eleva-care-app

# Validate configuration first
pnpm tsx scripts/utilities/workos-rbac-config.ts validate

# Generate all formats
pnpm tsx scripts/utilities/workos-rbac-config.ts generate-all
```

**What gets regenerated:**

- All CSV files
- JSON configuration
- Markdown documentation
- TypeScript constants
- This folder's contents

**⚠️ Important:**

- Files in this folder are auto-generated
- Don't edit these files directly
- Edit the source: `scripts/utilities/workos-rbac-config.ts`
- Then regenerate

---

## 📝 File Usage Guide

### For WorkOS Dashboard Import

**Best file to use:** `workos-rbac-config.md`

**Why:**

- Easy to read
- Copy-paste friendly sections
- Organized by category
- Includes resolved permissions (inheritance calculated)

**Alternative:** `workos-permissions.csv` + `workos-roles.csv`

### For Excel/Spreadsheet Analysis

**Best file to use:** `workos-role-permission-matrix.csv`

**Why:**

- Easy to sort/filter
- Visual overview
- Audit-friendly
- Compliance reports

**Alternative:** `workos-permissions.csv` + `workos-roles.csv`

### For Code Integration

**Best file to use:** `workos-rbac-constants.ts`

**Why:**

- Type-safe constants
- No typos
- Autocomplete support
- Role-permission mappings included

**Alternative:** `workos-rbac-config.json` (for dynamic loading)

### For API/Programmatic Access

**Best file to use:** `workos-rbac-config.json`

**Why:**

- Machine-readable
- Complete metadata
- Structured data
- Easy to parse

**Alternative:** Parse CSV files

### For Documentation

**Best file to use:** `workos-rbac-config.md`

**Why:**

- Human-readable
- GitHub-friendly
- Copy to wiki
- Print-friendly

**Alternative:** Convert JSON to HTML

---

## 🎯 Common Tasks

### Task: Create all permissions in WorkOS

1. Open `workos-rbac-config.md`
2. Go to "Copy-Paste Format" section
3. Find "All Permissions" list
4. Follow [IMPORT-CHECKLIST.md](./IMPORT-CHECKLIST.md)

### Task: Create a role with correct permissions

1. Open `workos-rbac-config.md`
2. Find the role section (e.g., "Expert Community")
3. Copy the permission list
4. Paste into WorkOS Dashboard

### Task: Verify role has correct permissions

1. Open `workos-role-permission-matrix.csv`
2. Find the role column
3. Check for "X" marks in permission rows
4. Compare with WorkOS Dashboard

### Task: Add permission to code

1. Open `workos-rbac-constants.ts`
2. Find the permission constant
3. Copy to your code:

```typescript
import { WORKOS_PERMISSIONS } from './workos-rbac-constants';

const canViewAnalytics = permissions.includes(WORKOS_PERMISSIONS.ANALYTICS_VIEW);
```

### Task: Check if role should have permission

1. Open `workos-rbac-config.md`
2. Search for the permission slug
3. Check the role-permission table
4. Verify in "Role Overview" section

---

## ⚠️ Important Notes

### WorkOS Limitations

- **No CSV Import:** WorkOS doesn't support bulk CSV import yet
- **Manual Creation:** All permissions/roles must be created manually
- **No API:** WorkOS doesn't provide public API for creating roles/permissions
- **Immutable Slugs:** Permission/role slugs can't be changed after creation

### Best Practices

- **Create Permissions First:** Must create ALL permissions before roles
- **Follow Order:** Create roles from lowest to highest priority
- **Double-Check Slugs:** They're immutable - spelling matters!
- **Use Checklist:** Follow [IMPORT-CHECKLIST.md](./IMPORT-CHECKLIST.md) to avoid mistakes
- **Test First:** Create in test environment before production

### Maintenance

- **Keep in Sync:** Keep script and WorkOS Dashboard in sync
- **Version Control:** Commit both script and generated files
- **Document Changes:** Update descriptions when adding permissions
- **Regenerate Often:** After any configuration change

---

## 🆘 Help & Support

### Need Help?

1. **Read the guide:** [HOW-TO-USE.md](./HOW-TO-USE.md)
2. **Check checklist:** [IMPORT-CHECKLIST.md](./IMPORT-CHECKLIST.md)
3. **Validate config:** Run validation command
4. **Contact team:** #dev-platform Slack channel

### Common Issues

**"File not found" error**

- Ensure you're in project root
- Check file path is correct
- Regenerate files if missing

**"Permission not found" in code**

- Regenerate TypeScript constants
- Check import path
- Verify permission exists in WorkOS

**"Duplicate slug" in WorkOS**

- Permission/role already exists
- Check if created in wrong environment
- Verify slug spelling

### Quick Commands

```bash
# Show configuration summary
pnpm tsx scripts/utilities/workos-rbac-config.ts summary

# Validate configuration
pnpm tsx scripts/utilities/workos-rbac-config.ts validate

# Regenerate all files
pnpm tsx scripts/utilities/workos-rbac-config.ts generate-all
```

---

## 📚 Related Documentation

### In This Folder

- [HOW-TO-USE.md](./HOW-TO-USE.md) - Complete usage guide
- [IMPORT-CHECKLIST.md](./IMPORT-CHECKLIST.md) - Step-by-step checklist

### In Parent Directory

- `../WORKOS-ROLES-PERMISSIONS-CONFIGURATION.md` - Complete RBAC specification
- `../WORKOS-DASHBOARD-QUICK-SETUP.md` - Quick setup guide
- `../WORKOS-RBAC-VISUAL-MATRIX.md` - Visual reference
- `../README.md` - Overview and navigation

### External

- [WorkOS RBAC Documentation](https://workos.com/docs/rbac)
- [WorkOS Dashboard](https://dashboard.workos.com)
- [Next.js 16 RBAC Guide](https://nextjs.org/docs/app/building-your-application/authentication)

---

## 🔐 Security Notes

- **Principle of Least Privilege:** Roles follow minimal permission approach
- **Role Hierarchy:** Higher priority roles don't automatically inherit lower permissions
- **Explicit Permissions:** All permissions must be explicitly assigned
- **Audit Trail:** Use permission matrix CSV for compliance audits
- **Regular Review:** Review permissions quarterly

---

**Generated by:** `scripts/utilities/workos-rbac-config.ts`  
**Source Control:** Committed to git repository  
**Last Updated:** November 13, 2025  
**Next Review:** After Phase 1 deployment
