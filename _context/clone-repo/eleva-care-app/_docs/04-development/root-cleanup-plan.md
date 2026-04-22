# 🧹 Root Directory Cleanup Plan

**Created:** January 13, 2025  
**Status:** Ready for execution

## 🔍 Audit Summary

Found **15 items** that can be cleaned up from the root directory:

### Category A: Temporary/Scratch Files (SAFE TO DELETE)

| File                   | Size      | Reason                        |
| ---------------------- | --------- | ----------------------------- |
| `@.scratchpad`         | 4.5 KB    | Temporary notes, not tracked  |
| `@.scratchpad `        | 0 bytes   | Empty temp file with space    |
| `svix_output.log`      | 391 bytes | Log file, regenerated         |
| `tsconfig.tsbuildinfo` | 4.7 MB    | TypeScript cache, regenerated |

**Total saved:** ~4.7 MB

### Category B: Downloaded Tools (SAFE TO DELETE)

| File/Folder                      | Size    | Reason                  |
| -------------------------------- | ------- | ----------------------- |
| `svix`                           | 12.6 MB | Webhooks CLI executable |
| `svix-cli-aarch64-apple-darwin/` | ~128 KB | CLI directory           |
| `svix-cli.tar.xz`                | 3.0 MB  | Archive file            |

**Total saved:** ~15.6 MB  
**Note:** These are Svix webhooks CLI tools. Can be reinstalled if needed via `npm install -g svix-cli`

### Category C: Duplicate Files (SAFE TO DELETE)

| File         | Reason               | Replacement                                |
| ------------ | -------------------- | ------------------------------------------ |
| `locales.ts` | Duplicate definition | `src/lib/i18n/routing.ts` has same content |

### Category D: Legacy Scripts (SAFE TO DELETE)

Located in `scripts/`:

| File                              | Reason                            | Last Used                 |
| --------------------------------- | --------------------------------- | ------------------------- |
| `apply-rls-clean.ts`              | RLS migration script, executed    | WorkOS migration Nov 2025 |
| `apply-rls-migration.ts`          | RLS migration script, executed    | WorkOS migration Nov 2025 |
| `apply-rls-neon.ts`               | RLS migration script, executed    | WorkOS migration Nov 2025 |
| `apply-subscription-plans-rls.ts` | RLS migration script, executed    | WorkOS migration Nov 2025 |
| `check-subscription-plans-rls.ts` | RLS check script, executed        | WorkOS migration Nov 2025 |
| `verify-all-rls.ts`               | RLS verification script, executed | WorkOS migration Nov 2025 |
| `verify-rls.ts`                   | RLS verification script, executed | WorkOS migration Nov 2025 |

**Action:** Move to `scripts/utilities/archive/rls-migration/`  
**Documented in:** `docs/02-core-systems/authentication/06-fixes-changelog.md`

### Category E: Unused File (NEEDS REVIEW)

| File                        | Reason                              | Action                                    |
| --------------------------- | ----------------------------------- | ----------------------------------------- |
| `instrumentation-client.ts` | BotID config, but not auto-imported | DELETE - BotID imported directly in files |

**Finding:** Next.js 16 doesn't auto-import instrumentation files. BotID is configured directly in `next.config.ts` and imported in route files.

### Category F: Legacy Resources (REVIEW)

`_resources/` folder contents:

| Item                                      | Size    | Keep? | Reason             |
| ----------------------------------------- | ------- | ----- | ------------------ |
| `_archive.zip`                            | Unknown | ❓    | Unknown contents   |
| `clerk/Clerk Frontend API Reference.json` | ~KB     | ❌    | Migrated to WorkOS |
| `Expert Marketing Best Practices.pdf`     | ~MB     | ✅    | Move to `_docs/`   |

---

## 📋 Cleanup Commands

### Step 1: Add to .gitignore (if not already there)

```bash
# TypeScript cache
tsconfig.tsbuildinfo

# Logs
*.log

# Temp files
@.scratchpad*
```

### Step 2: Delete Temporary Files

```bash
cd /Users/rodrigo.barona/Documents/GitHub/eleva-care-app

# Remove temp/scratch files
rm -f "@.scratchpad" "@.scratchpad " svix_output.log tsconfig.tsbuildinfo
```

### Step 3: Delete Downloaded Tools

```bash
# Remove Svix CLI (can reinstall via: npm install -g svix-cli)
rm -f svix svix-cli.tar.xz
rm -rf svix-cli-aarch64-apple-darwin
```

### Step 4: Remove Duplicate Files

```bash
# Remove duplicate locales (exists in src/lib/i18n/routing.ts)
rm -f locales.ts
```

### Step 5: Remove Unused Instrumentation

```bash
# BotID is imported directly, not via instrumentation
rm -f instrumentation-client.ts
```

### Step 6: Archive Legacy Scripts

```bash
# Create archive directory
mkdir -p scripts/utilities/archive/rls-migration

# Move RLS scripts
mv scripts/apply-rls-clean.ts scripts/utilities/archive/rls-migration/
mv scripts/apply-rls-migration.ts scripts/utilities/archive/rls-migration/
mv scripts/apply-rls-neon.ts scripts/utilities/archive/rls-migration/
mv scripts/apply-subscription-plans-rls.ts scripts/utilities/archive/rls-migration/
mv scripts/check-subscription-plans-rls.ts scripts/utilities/archive/rls-migration/
mv scripts/verify-all-rls.ts scripts/utilities/archive/rls-migration/
mv scripts/verify-rls.ts scripts/utilities/archive/rls-migration/

# Create README
cat > scripts/utilities/archive/rls-migration/README.md << 'EOF'
# RLS Migration Scripts (Archive)

**Status:** ✅ Executed successfully during WorkOS migration (November 2025)

These scripts were used during the Clerk → WorkOS migration to apply Row-Level Security policies.

**Do NOT run these scripts again** unless you are redoing the entire authentication migration.

## Documentation

See `docs/02-core-systems/authentication/06-fixes-changelog.md` for details on what these scripts accomplished.
EOF
```

### Step 7: Clean \_resources Folder

```bash
# Remove old Clerk documentation
rm -rf _resources/clerk

# Move marketing PDF to docs
mv "_resources/Expert Marketing Best Practices.pdf" _docs/05-guides/

# Review archive.zip contents first, then decide
unzip -l _resources/_archive.zip
# If not needed: rm _resources/_archive.zip
```

### Step 8: Update scripts/README.md

Document the archived RLS scripts in the README.

---

## ✅ Expected Results

### Before Cleanup

```
Root Directory: 40+ items
Total Size: ~20 MB of deletable files
```

### After Cleanup

```
Root Directory: ~25 items
Space Saved: ~20 MB
Structure: Much cleaner and organized
```

### Final Root Structure

```
eleva-care-app/
├── _docs/                    # Documentation (cleaned)
├── _resources/               # Resources (minimal)
├── drizzle/                  # Database
├── public/                   # Static assets
├── scripts/                  # Active scripts only
│   └── utilities/
│       └── archive/          # Archived one-time scripts
├── src/                      # All app code
├── tests/                    # Tests
└── [15 config files]         # Essential configs
```

---

## 🔒 Safety Notes

1. **Safe to delete immediately:**
   - Temp files, logs, cache files
   - Downloaded CLI tools (reinstallable)
   - Duplicate files

2. **Archive before deleting:**
   - Legacy scripts (keep for reference)

3. **Review before deleting:**
   - `_resources/_archive.zip` - Check contents first

4. **Keep:**
   - `audit.config.ts` - Used for audit database
   - All config files (tsconfig, next.config, etc.)
   - drizzle/, public/, scripts/, src/, tests/

---

## 📊 Verification Checklist

After cleanup:

- [ ] Run `pnpm dev` - App starts successfully
- [ ] Run `pnpm type-check` - No TypeScript errors
- [ ] Run `pnpm lint` - No linting errors
- [ ] Run `pnpm build` - Build succeeds
- [ ] Check git status - Only intended files deleted
- [ ] Verify scripts still work: `pnpm auditdb:generate`

---

**Total Impact:**

- ✅ ~20 MB space saved
- ✅ 15 fewer items at root
- ✅ Cleaner, more professional structure
- ✅ No functionality lost
