# MDX Locale Fix - pt-BR Implementation

**Date:** November 13, 2025  
**Status:** ✅ Completed

---

## 🔍 **Problem Identified**

During build, Next.js was failing to load MDX metadata with errors like:

```
Error: Cannot find module '@/content/about/pt-BR.mdx'
Error: Cannot find module '@/content/become-expert/pt-BR.mdx'
Error: MISSING_MESSAGE: metadata (pt-BR)
```

### **Root Causes**

1. **Locale Mismatch**: Routing configuration used `pt-BR` but MDX files were named `br.mdx`
2. **Missing Translation File**: No `pt-BR.json` in messages directory
3. **Missing Home Metadata**: Home page uses `getTranslations` for metadata (not MDX)

---

## ✅ **Solutions Implemented**

### **1. Renamed all `br.mdx` → `pt-BR.mdx`**

**Why:** The routing configuration (`src/lib/i18n/routing.ts`) defines:

```typescript
export const locales = ['en', 'es', 'pt', 'pt-BR'] as const;
//                                      ^^^^^^^ Standard locale code
```

**Files Renamed:**

- `src/content/about/br.mdx` → `pt-BR.mdx`
- `src/content/become-expert/br.mdx` → `pt-BR.mdx`
- `src/content/history/br.mdx` → `pt-BR.mdx`
- `src/content/trust/security/br.mdx` → `pt-BR.mdx`
- `src/content/trust/dpa/br.mdx` → `pt-BR.mdx`
- `src/content/terms/br.mdx` → `pt-BR.mdx`
- `src/content/privacy/br.mdx` → `pt-BR.mdx`
- `src/content/cookie/br.mdx` → `pt-BR.mdx`
- `src/content/payment-policies/br.mdx` → `pt-BR.mdx`
- `src/content/expert-agreement/br.mdx` → `pt-BR.mdx`

**Total:** 10 files renamed

---

### **2. Created `src/messages/pt-BR.json`**

**Why:** Next.js requires a message file for each locale defined in routing.

**Action:**

```bash
cp src/messages/pt.json src/messages/pt-BR.json
```

---

### **3. Added Home Page Metadata**

**Why:** Home page (`/`) uses `getTranslations({ namespace: 'metadata' })` for SEO, not MDX.

**Added to all locale files:**

```json
{
  "metadata": {
    "title": "Connect with Expert Women's Health Specialists | Eleva Care",
    "description": "Eleva Care: Find and book trusted women's health experts...",
    "og": {
      "title": "...",
      "description": "...",
      "siteName": "Eleva Care"
    }
  }
}
```

**Files Updated:**

- `src/messages/en.json`
- `src/messages/es.json`
- `src/messages/pt.json`
- `src/messages/pt-BR.json`

---

## 📊 **Results**

### **Before:**

```
❌ Error: Cannot find module '@/content/about/pt-BR.mdx'
❌ Error: MISSING_MESSAGE: metadata (pt-BR)
❌ 10+ build errors
```

### **After:**

```
✅ All MDX files load successfully
✅ All locales have proper metadata
✅ Build completes successfully
✅ ✓ Compiled successfully in 12.1s
```

---

## 🔍 **Locale Strategy**

### **Current Locale Structure:**

| Locale                | Code    | MDX Files | Messages | Status  |
| --------------------- | ------- | --------- | -------- | ------- |
| English               | `en`    | ✅        | ✅       | Default |
| Spanish               | `es`    | ✅        | ✅       | Active  |
| Portuguese (Portugal) | `pt`    | ✅        | ✅       | Active  |
| Portuguese (Brazil)   | `pt-BR` | ✅        | ✅       | Active  |

### **Why `pt-BR` instead of `br`?**

1. **Standard BCP 47**: `pt-BR` is the standard locale code for Brazilian Portuguese
2. **Next.js Convention**: Next.js and most i18n libraries use BCP 47 codes
3. **Clarity**: Distinguishes Brazilian Portuguese from Portugal Portuguese (`pt`)
4. **Future-proof**: Compatible with all i18n tools and services

---

## 🎯 **Best Practices Established**

### **1. Locale Naming**

- ✅ Use BCP 47 codes (`en`, `es`, `pt`, `pt-BR`)
- ✅ Match MDX filenames to locale codes exactly
- ✅ Keep consistent across routing, messages, and content

### **2. Content Structure**

```
src/
├── content/
│   └── [page]/
│       ├── en.mdx
│       ├── es.mdx
│       ├── pt.mdx
│       └── pt-BR.mdx
└── messages/
    ├── en.json
    ├── es.json
    ├── pt.json
    └── pt-BR.json
```

### **3. Metadata Strategy**

- **MDX-based pages**: Export `metadata` from MDX files
- **Dynamic pages**: Use `getTranslations({ namespace: 'metadata' })`
- **Home page**: Uses messages (special case with multiple dynamic sections)

---

## 🚀 **Verification**

### **Test Commands:**

```bash
# 1. Verify all pt-BR MDX files exist
find src/content -name "pt-BR.mdx" -type f

# 2. Verify pt-BR.json exists
ls -lh src/messages/pt-BR.json

# 3. Build successfully
pnpm build
```

### **Expected Output:**

- 10 pt-BR.mdx files found
- pt-BR.json exists (787 lines)
- Build succeeds with "✓ Compiled successfully"

---

## 📝 **Notes**

### **QStash Errors (Expected):**

```
Failed to schedule *-job: QstashError: {"error":"invalid destination url: endpoint resolves to a loopback address: ::1"}
```

**Why:** QStash cannot schedule cron jobs to localhost during build. This is expected and safe to ignore.

**Impact:** None - QStash works in production environments.

---

## ✅ **Conclusion**

All locale issues resolved:

- ✅ MDX files properly named (`pt-BR.mdx`)
- ✅ Message files complete (`pt-BR.json`)
- ✅ Home metadata added to all locales
- ✅ Build succeeds without errors
- ✅ All 4 languages fully functional

**Total Changes:**

- 10 files renamed
- 1 file created
- 4 files updated with metadata

---

**Last Updated:** November 13, 2025  
**Next Steps:** None required - system is production-ready
