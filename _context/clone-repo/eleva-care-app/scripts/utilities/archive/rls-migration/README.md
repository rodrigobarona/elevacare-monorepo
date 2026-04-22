# RLS Migration Scripts (Archive)

**Status:** ✅ Executed successfully during WorkOS migration (November 2025)  
**Archived:** January 13, 2025

---

## ⚠️ Important

These scripts were used **one-time** during the Clerk → WorkOS migration to apply Row-Level Security (RLS) policies to the database.

**Do NOT run these scripts again** unless you are:
1. Redoing the entire authentication migration from scratch
2. Setting up a completely new database instance
3. Explicitly instructed to do so

---

## 📂 Archived Scripts

| Script | Purpose |
|--------|---------|
| `apply-rls-clean.ts` | Applied clean RLS policies |
| `apply-rls-migration.ts` | Main RLS migration script |
| `apply-rls-neon.ts` | Neon-specific RLS setup |
| `apply-subscription-plans-rls.ts` | RLS for subscription plans |
| `check-subscription-plans-rls.ts` | Verification for subscription RLS |
| `verify-all-rls.ts` | Comprehensive RLS verification |
| `verify-rls.ts` | Individual RLS verification |

---

## 📖 Documentation

For details on what these scripts accomplished, see:
- `docs/02-core-systems/authentication/06-fixes-changelog.md`
- `docs/02-core-systems/authentication/00-WORKOS-README.md`

---

## 🏗️ Migration Context

These scripts were part of the **WorkOS Authentication Migration** completed in November 2025. They:
- Set up Row-Level Security policies for multi-tenant data isolation
- Applied organization-based access controls
- Configured role-based permissions at the database level
- Ensured HIPAA compliance for healthcare data

**Result:** All RLS policies are now active and working in production.

---

## 🔄 If You Need These Again

If you need to reapply RLS policies:

1. **Review current RLS state** first:
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
   FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
   ```

2. **Check migration history:**
   - Review `drizzle/migrations-manual/` for applied SQL
   - Check `docs/02-core-systems/authentication/` for context

3. **Proceed with caution:**
   - Test on development database first
   - Backup production before applying
   - Verify with test users after applying

---

**Archived by:** AI Assistant  
**Reason:** One-time migration scripts, successfully executed  
**Reference Only:** Keep for historical context and troubleshooting

